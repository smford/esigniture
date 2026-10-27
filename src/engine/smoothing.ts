import { Point, SmoothedPoint, Stroke, BoundingBox } from '../types';

export function calculateDistance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.hypot(dx, dy);
}

export function getMidPoint(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

/**
 * Filters raw points to eliminate micro-jitter and duplicate coordinates.
 */
export function filterRawPoints(rawPoints: Point[], minDistance = 2.0): Point[] {
  if (rawPoints.length <= 1) return [...rawPoints];

  const filtered: Point[] = [rawPoints[0]];

  for (let i = 1; i < rawPoints.length; i++) {
    const prev = filtered[filtered.length - 1];
    const curr = rawPoints[i];
    const dist = calculateDistance(prev, curr);

    // Keep points that exceed minimum distance or are the final point
    if (dist >= minDistance || i === rawPoints.length - 1) {
      filtered.push(curr);
    }
  }

  return filtered;
}

/**
 * Smooths raw stroke points using exponential moving averages,
 * dynamic velocity-sensitive line width modulation, and curve interpolation.
 */
export function smoothStrokePoints(
  rawPoints: Point[],
  baseWidth: number,
  smoothingFactor: number, // 0 to 1
  isDynamic: boolean
): SmoothedPoint[] {
  if (rawPoints.length === 0) return [];

  // Minimum 1 point: single tap/dot
  if (rawPoints.length === 1) {
    return [
      {
        x: rawPoints[0].x,
        y: rawPoints[0].y,
        width: baseWidth,
      },
    ];
  }

  // Pre-filter points for jitter removal
  const filtered = filterRawPoints(rawPoints, 1.5 + smoothingFactor * 1.5);
  if (filtered.length === 1) {
    return [{ x: filtered[0].x, y: filtered[0].y, width: baseWidth }];
  }

  // Alpha factor for exponential smoothing:
  // factor 0 -> alpha = 1.0 (no smoothing)
  // factor 1 -> alpha = 0.25 (silky smooth)
  const alpha = 1.0 - Math.min(0.75, Math.max(0, smoothingFactor * 0.75));

  const smoothed: SmoothedPoint[] = [];
  let prevSmoothedX = filtered[0].x;
  let prevSmoothedY = filtered[0].y;
  let rollingVelocity = 0;

  for (let i = 0; i < filtered.length; i++) {
    const raw = filtered[i];

    let smoothX: number;
    let smoothY: number;

    if (i === 0) {
      smoothX = raw.x;
      smoothY = raw.y;
    } else if (i === filtered.length - 1) {
      // Anchoring the exact end point so signature endings are crisp
      smoothX = raw.x;
      smoothY = raw.y;
    } else {
      // Weighted moving average
      smoothX = prevSmoothedX + alpha * (raw.x - prevSmoothedX);
      smoothY = prevSmoothedY + alpha * (raw.y - prevSmoothedY);
    }

    // Velocity and line width calculation
    let calculatedWidth = baseWidth;

    if (isDynamic && i > 0) {
      const prevRaw = filtered[i - 1];
      const dt = Math.max(1, raw.time - prevRaw.time);
      const dist = calculateDistance({ x: smoothX, y: smoothY }, { x: prevSmoothedX, y: prevSmoothedY });
      const currentVelocity = dist / dt; // pixels per millisecond

      rollingVelocity = rollingVelocity * 0.6 + currentVelocity * 0.4;

      // Higher velocity gives slightly thinner, dynamic ink trail (realistic pen physics)
      // Clamped between 0.45x and 1.35x base width
      const velocityRatio = Math.min(1.0, rollingVelocity / 1.8);
      calculatedWidth = baseWidth * (1.25 - 0.65 * velocityRatio);

      // If hardware pressure is present (stylus / force touch)
      if (raw.pressure && raw.pressure > 0 && raw.pressure !== 0.5) {
        calculatedWidth *= 0.4 + 1.2 * raw.pressure;
      }
    }

    calculatedWidth = Math.max(1, Math.min(baseWidth * 2.0, calculatedWidth));

    smoothed.push({
      x: smoothX,
      y: smoothY,
      width: calculatedWidth,
    });

    prevSmoothedX = smoothX;
    prevSmoothedY = smoothY;
  }

  return smoothed;
}

/**
 * Calculates the bounding box enclosing all strokes, with optional padding.
 */
export function computeBoundingBox(
  strokes: Stroke[],
  padding = 20,
  minWidth = 100,
  minHeight = 60
): BoundingBox | null {
  if (strokes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  let hasPoints = false;

  for (const stroke of strokes) {
    for (const pt of stroke.smoothedPoints) {
      hasPoints = true;
      const r = stroke.baseWidth;
      minX = Math.min(minX, pt.x - r);
      minY = Math.min(minY, pt.y - r);
      maxX = Math.max(maxX, pt.x + r);
      maxY = Math.max(maxY, pt.y + r);
    }
  }

  if (!hasPoints) return null;

  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = maxX + padding;
  maxY = maxY + padding;

  let width = maxX - minX;
  let height = maxY - minY;

  if (width < minWidth) {
    const diff = (minWidth - width) / 2;
    minX = Math.max(0, minX - diff);
    width = minWidth;
    maxX = minX + width;
  }

  if (height < minHeight) {
    const diff = (minHeight - height) / 2;
    minY = Math.max(0, minY - diff);
    height = minHeight;
    maxY = minY + height;
  }

  return {
    minX: Math.floor(minX),
    minY: Math.floor(minY),
    maxX: Math.ceil(maxX),
    maxY: Math.ceil(maxY),
    width: Math.ceil(width),
    height: Math.ceil(height),
  };
}

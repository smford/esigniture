import { Stroke, BoundingBox, ExportFormat, SignatureConfig } from '../types';
import { getMidPoint, computeBoundingBox } from './smoothing';

export interface ExportOptions {
  canvasWidth: number;
  canvasHeight: number;
  config: SignatureConfig;
  format: ExportFormat;
}

/**
 * Draws a single stroke onto a Canvas 2D context using smooth midpoint Bézier curves.
 */
export function drawStrokeToContext(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  offsetX = 0,
  offsetY = 0
): void {
  const pts = stroke.smoothedPoints;
  if (!pts || pts.length === 0) return;

  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (pts.length === 1) {
    // Single dot
    const p = pts[0];
    const r = Math.max(1, p.width / 2);
    ctx.beginPath();
    ctx.arc(p.x - offsetX, p.y - offsetY, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (pts.length === 2) {
    ctx.lineWidth = pts[0].width;
    ctx.beginPath();
    ctx.moveTo(pts[0].x - offsetX, pts[0].y - offsetY);
    ctx.lineTo(pts[1].x - offsetX, pts[1].y - offsetY);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Draw continuous stroke with dynamic segment widths
  for (let i = 0; i < pts.length - 1; i++) {
    const current = pts[i];
    const next = pts[i + 1];

    ctx.lineWidth = current.width;
    ctx.beginPath();

    if (i === 0) {
      const mid = getMidPoint(current, next);
      ctx.moveTo(current.x - offsetX, current.y - offsetY);
      ctx.lineTo(mid.x - offsetX, mid.y - offsetY);
    } else {
      const prev = pts[i - 1];
      const prevMid = getMidPoint(prev, current);
      const currMid = getMidPoint(current, next);
      ctx.moveTo(prevMid.x - offsetX, prevMid.y - offsetY);
      ctx.quadraticCurveTo(
        current.x - offsetX,
        current.y - offsetY,
        currMid.x - offsetX,
        currMid.y - offsetY
      );
    }

    if (i === pts.length - 2) {
      // Connect to the final point
      const mid = getMidPoint(current, next);
      ctx.moveTo(mid.x - offsetX, mid.y - offsetY);
      ctx.lineTo(next.x - offsetX, next.y - offsetY);
    }

    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Generates clean, resolution-independent SVG markup for the given strokes.
 */
export function generateSvg(
  strokes: Stroke[],
  width: number,
  height: number,
  config: SignatureConfig,
  bbox: BoundingBox | null
): string {
  const isTrimmed = config.trimWhitespace && bbox !== null;
  const targetWidth = isTrimmed ? bbox.width : width;
  const targetHeight = isTrimmed ? bbox.height : height;
  const viewBoxX = isTrimmed ? bbox.minX : 0;
  const viewBoxY = isTrimmed ? bbox.minY : 0;

  let bgElement = '';
  if (config.backgroundType !== 'transparent' && config.backgroundColor) {
    bgElement = `  <rect x="${viewBoxX}" y="${viewBoxY}" width="${targetWidth}" height="${targetHeight}" fill="${config.backgroundColor}" />\n`;
  }

  let paths = '';

  for (const stroke of strokes) {
    const pts = stroke.smoothedPoints;
    if (pts.length === 0) continue;

    if (pts.length === 1) {
      const p = pts[0];
      const r = (p.width / 2).toFixed(2);
      paths += `  <circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${r}" fill="${stroke.color}" />\n`;
      continue;
    }

    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;

    if (pts.length === 2) {
      d += ` L ${pts[1].x.toFixed(2)} ${pts[1].y.toFixed(2)}`;
    } else {
      for (let i = 0; i < pts.length - 1; i++) {
        const current = pts[i];
        const next = pts[i + 1];
        const mid = getMidPoint(current, next);

        if (i === 0) {
          d += ` L ${mid.x.toFixed(2)} ${mid.y.toFixed(2)}`;
        } else {
          d += ` Q ${current.x.toFixed(2)} ${current.y.toFixed(2)}, ${mid.x.toFixed(2)} ${mid.y.toFixed(2)}`;
        }
      }
      const last = pts[pts.length - 1];
      d += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
    }

    paths += `  <path d="${d}" fill="none" stroke="${stroke.color}" stroke-width="${stroke.baseWidth}" stroke-linecap="round" stroke-linejoin="round" />\n`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxX} ${viewBoxY} ${targetWidth} ${targetHeight}" width="${targetWidth}" height="${targetHeight}">
${bgElement}${paths}</svg>`;
}

/**
 * Creates an offscreen rendered canvas for raster exports (PNG, JPEG, WebP).
 */
export function renderToOffscreenCanvas(
  strokes: Stroke[],
  originalWidth: number,
  originalHeight: number,
  config: SignatureConfig,
  bbox: BoundingBox | null
): HTMLCanvasElement {
  const isTrimmed = config.trimWhitespace && bbox !== null;
  const targetWidth = isTrimmed ? bbox.width : originalWidth;
  const targetHeight = isTrimmed ? bbox.height : originalHeight;
  const offsetX = isTrimmed ? bbox.minX : 0;
  const offsetY = isTrimmed ? bbox.minY : 0;

  const canvas = document.createElement('canvas');
  // 2x supersampling for ultra-crisp raster exports
  const scale = 2;
  canvas.width = Math.max(1, Math.round(targetWidth * scale));
  canvas.height = Math.max(1, Math.round(targetHeight * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D context for offscreen canvas');

  ctx.scale(scale, scale);

  // Background
  if (config.backgroundType !== 'transparent' && config.backgroundColor) {
    ctx.fillStyle = config.backgroundColor;
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  } else if (config.backgroundType === 'transparent') {
    ctx.clearRect(0, 0, targetWidth, targetHeight);
  }

  // Draw strokes
  for (const stroke of strokes) {
    drawStrokeToContext(ctx, stroke, offsetX, offsetY);
  }

  return canvas;
}

/**
 * Downloads a Blob as a file with the given filename.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Exports the signature in the desired format.
 */
export async function exportSignature(
  strokes: Stroke[],
  width: number,
  height: number,
  config: SignatureConfig,
  format: ExportFormat
): Promise<{ success: boolean; message: string }> {
  if (strokes.length === 0) {
    return { success: false, message: 'Please draw a signature before downloading.' };
  }

  const bbox = computeBoundingBox(strokes, config.padding);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const baseFilename = `signature-${timestamp}`;

  if (format === 'svg') {
    const svgContent = generateSvg(strokes, width, height, config, bbox);
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    triggerDownload(blob, `${baseFilename}.svg`);
    return { success: true, message: 'Downloaded scalable SVG signature.' };
  }

  const offscreen = renderToOffscreenCanvas(strokes, width, height, config, bbox);

  let mimeType = 'image/png';
  let quality: number | undefined = undefined;

  if (format === 'jpeg') {
    mimeType = 'image/jpeg';
    quality = 0.95;
    // JPEG doesn't support transparency - if transparent was chosen, default to white
    if (config.backgroundType === 'transparent') {
      const whiteCanvas = document.createElement('canvas');
      whiteCanvas.width = offscreen.width;
      whiteCanvas.height = offscreen.height;
      const wCtx = whiteCanvas.getContext('2d');
      if (wCtx) {
        wCtx.fillStyle = '#ffffff';
        wCtx.fillRect(0, 0, whiteCanvas.width, whiteCanvas.height);
        wCtx.drawImage(offscreen, 0, 0);
        return new Promise((resolve) => {
          whiteCanvas.toBlob(
            (blob) => {
              if (blob) {
                triggerDownload(blob, `${baseFilename}.jpg`);
                resolve({ success: true, message: 'Downloaded JPEG signature.' });
              } else {
                resolve({ success: false, message: 'Failed to create JPEG blob.' });
              }
            },
            mimeType,
            quality
          );
        });
      }
    }
  } else if (format === 'webp') {
    mimeType = 'image/webp';
    quality = 0.95;
  }

  return new Promise((resolve) => {
    offscreen.toBlob(
      (blob) => {
        if (blob) {
          triggerDownload(blob, `${baseFilename}.${format}`);
          resolve({ success: true, message: `Downloaded ${format.toUpperCase()} signature.` });
        } else {
          resolve({ success: false, message: `Failed to create ${format} file.` });
        }
      },
      mimeType,
      quality
    );
  });
}

/**
 * Copies the signature directly to the user's system clipboard as a PNG image.
 */
export async function copySignatureToClipboard(
  strokes: Stroke[],
  width: number,
  height: number,
  config: SignatureConfig
): Promise<{ success: boolean; message: string }> {
  if (strokes.length === 0) {
    return { success: false, message: 'Please draw a signature before copying.' };
  }

  if (!navigator.clipboard || !window.ClipboardItem) {
    return { success: false, message: 'Clipboard image writing is not supported by your browser.' };
  }

  const bbox = computeBoundingBox(strokes, config.padding);
  const offscreen = renderToOffscreenCanvas(strokes, width, height, config, bbox);

  return new Promise((resolve) => {
    offscreen.toBlob(async (blob) => {
      if (!blob) {
        resolve({ success: false, message: 'Failed to render image for clipboard.' });
        return;
      }
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob,
          }),
        ]);
        resolve({ success: true, message: 'Signature copied to clipboard!' });
      } catch (err) {
        console.error('Clipboard copy error:', err);
        resolve({
          success: false,
          message: 'Could not copy to clipboard. Please check browser permissions.',
        });
      }
    }, 'image/png');
  });
}

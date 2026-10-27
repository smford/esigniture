import { describe, it, expect } from 'vitest';
import {
  calculateDistance,
  getMidPoint,
  filterRawPoints,
  smoothStrokePoints,
  computeBoundingBox,
} from './smoothing';
import { generateSvg, measureTypedSignature } from './exporter';
import { Stroke, SignatureConfig } from '../types';

describe('Smoothing Engine', () => {
  it('calculates Euclidean distance accurately', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 3, y: 4 };
    expect(calculateDistance(p1, p2)).toBe(5);
  });

  it('calculates midpoints accurately', () => {
    const p1 = { x: 10, y: 20 };
    const p2 = { x: 20, y: 40 };
    const mid = getMidPoint(p1, p2);
    expect(mid).toEqual({ x: 15, y: 30 });
  });

  it('filters out micro-jitter points below minimum distance', () => {
    const raw = [
      { x: 0, y: 0, time: 100 },
      { x: 0.5, y: 0.5, time: 105 }, // jitter (< 2px)
      { x: 10, y: 10, time: 110 },
      { x: 20, y: 20, time: 120 },
    ];
    const filtered = filterRawPoints(raw, 2.0);
    expect(filtered.length).toBe(3);
    expect(filtered[0]).toEqual(raw[0]);
    expect(filtered[1]).toEqual(raw[2]);
    expect(filtered[2]).toEqual(raw[3]);
  });

  it('handles single point dot strokes correctly', () => {
    const raw = [{ x: 50, y: 50, time: 100 }];
    const smoothed = smoothStrokePoints(raw, 4, 0.5, true);
    expect(smoothed.length).toBe(1);
    expect(smoothed[0].x).toBe(50);
    expect(smoothed[0].y).toBe(50);
    expect(smoothed[0].width).toBe(4);
  });

  it('smooths multi-point tracks with non-zero coordinates and valid widths', () => {
    const raw = [
      { x: 10, y: 10, time: 100 },
      { x: 20, y: 15, time: 110 },
      { x: 35, y: 25, time: 120 },
      { x: 55, y: 40, time: 130 },
      { x: 80, y: 60, time: 140 },
    ];
    const smoothed = smoothStrokePoints(raw, 3, 0.6, true);
    expect(smoothed.length).toBeGreaterThan(2);

    for (const pt of smoothed) {
      expect(pt.x).toBeGreaterThan(0);
      expect(pt.y).toBeGreaterThan(0);
      expect(pt.width).toBeGreaterThan(0);
    }
  });

  it('computes accurate bounding box with padding', () => {
    const stroke: Stroke = {
      id: 'test-1',
      points: [],
      smoothedPoints: [
        { x: 100, y: 100, width: 4 },
        { x: 200, y: 250, width: 4 },
      ],
      color: '#000000',
      baseWidth: 4,
      smoothingFactor: 0.5,
      isDynamic: true,
    };

    const bbox = computeBoundingBox([stroke], 20);
    expect(bbox).not.toBeNull();
    if (bbox) {
      expect(bbox.minX).toBeLessThanOrEqual(100);
      expect(bbox.minY).toBeLessThanOrEqual(100);
      expect(bbox.maxX).toBeGreaterThanOrEqual(200);
      expect(bbox.maxY).toBeGreaterThanOrEqual(250);
      expect(bbox.width).toBeGreaterThan(100);
      expect(bbox.height).toBeGreaterThan(150);
    }
  });

  it('returns null bounding box for empty strokes', () => {
    const bbox = computeBoundingBox([]);
    expect(bbox).toBeNull();
  });

  it('generates valid SVG markup', () => {
    const stroke: Stroke = {
      id: 'test-stroke',
      points: [],
      smoothedPoints: [
        { x: 50, y: 50, width: 3 },
        { x: 100, y: 70, width: 3 },
        { x: 150, y: 50, width: 3 },
      ],
      color: '#1e3a8a',
      baseWidth: 3,
      smoothingFactor: 0.5,
      isDynamic: false,
    };

    const config: SignatureConfig = {
      mode: 'draw',
      typedText: '',
      typedFont: 'Caveat',
      typedFontSize: 56,
      strokeColor: '#1e3a8a',
      strokeWidth: 3,
      backgroundColor: '#ffffff',
      backgroundType: 'white',
      smoothingFactor: 0.5,
      dynamicPressure: false,
      showBaseline: false,
      trimWhitespace: false,
      padding: 20,
    };

    const svg = generateSvg([stroke], 400, 200, config, null);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('viewBox="0 0 400 200"');
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain('stroke="#1e3a8a"');
    expect(svg).toContain('<path d="M 50.00 50.00');
  });

  it('measures typed signature and generates typed SVG with cursive font', () => {
    const textInfo = measureTypedSignature('John Doe', 'Caveat', 56, 400, 200, 20);
    expect(textInfo.bbox.width).toBeGreaterThan(50);
    expect(textInfo.bbox.height).toBeGreaterThan(20);

    const typeConfig: SignatureConfig = {
      mode: 'type',
      typedText: 'John Doe',
      typedFont: 'Caveat',
      typedFontSize: 56,
      strokeColor: '#0f172a',
      strokeWidth: 3,
      backgroundColor: '',
      backgroundType: 'transparent',
      smoothingFactor: 0.6,
      dynamicPressure: true,
      showBaseline: true,
      trimWhitespace: true,
      padding: 20,
    };

    const svg = generateSvg([], 400, 200, typeConfig, null);
    expect(svg).toContain('<svg');
    expect(svg).toContain('<text');
    expect(svg).toContain('font-family="\'Caveat\', cursive, sans-serif"');
    expect(svg).toContain('John Doe</text>');
  });
});

export interface Point {
  x: number;
  y: number;
  time: number;
  pressure?: number;
}

export interface SmoothedPoint {
  x: number;
  y: number;
  width: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  smoothedPoints: SmoothedPoint[];
  color: string;
  baseWidth: number;
  smoothingFactor: number; // 0 to 1
  isDynamic: boolean;
}

export type BackgroundType = 'transparent' | 'white' | 'cream' | 'dark' | 'custom';

export interface SignatureConfig {
  strokeColor: string;
  strokeWidth: number;
  backgroundColor: string;
  backgroundType: BackgroundType;
  smoothingFactor: number; // 0 (raw) to 1 (max smooth)
  dynamicPressure: boolean;
  showBaseline: boolean;
  trimWhitespace: boolean;
  padding: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export type ExportFormat = 'png' | 'svg' | 'jpeg' | 'webp';

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
  smoothingFactor: number;
  isDynamic: boolean;
}

export type BackgroundType = 'transparent' | 'white' | 'cream' | 'dark' | 'custom';
export type SignatureMode = 'draw' | 'type';

export interface SignatureConfig {
  mode: SignatureMode;
  typedText: string;
  typedFont: string;
  typedFontSize: number;
  strokeColor: string;
  strokeWidth: number;
  backgroundColor: string;
  backgroundType: BackgroundType;
  smoothingFactor: number;
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

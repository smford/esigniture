import { Point, Stroke, SignatureConfig } from '../types';
import { smoothStrokePoints } from './smoothing';
import { drawStrokeToContext } from './exporter';

export interface SignatureCanvasOptions {
  canvas: HTMLCanvasElement;
  config: SignatureConfig;
  onChange?: () => void;
}

export class SignatureCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: SignatureConfig;
  private strokes: Stroke[] = [];
  private redoStack: Stroke[] = [];
  private currentRawPoints: Point[] = [];
  private isDrawing = false;
  private activePointerId: number | null = null;
  private onChange?: () => void;
  private dpr = 1;
  private resizeObserver: ResizeObserver | null = null;

  constructor(options: SignatureCanvasOptions) {
    this.canvas = options.canvas;
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not obtain 2D rendering context');
    }
    this.ctx = context;
    this.config = options.config;
    this.onChange = options.onChange;

    this.initCanvasSize();
    this.attachEventListeners();
    this.render();
  }

  public updateConfig(newConfig: Partial<SignatureConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.render();
  }

  public getConfig(): SignatureConfig {
    return { ...this.config };
  }

  public getStrokes(): Stroke[] {
    return [...this.strokes];
  }

  public isEmpty(): boolean {
    return this.strokes.length === 0;
  }

  public canUndo(): boolean {
    return this.strokes.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public undo(): void {
    if (!this.canUndo()) return;
    const popped = this.strokes.pop();
    if (popped) {
      this.redoStack.push(popped);
      this.render();
      this.notifyChange();
    }
  }

  public redo(): void {
    if (!this.canRedo()) return;
    const restored = this.redoStack.pop();
    if (restored) {
      this.strokes.push(restored);
      this.render();
      this.notifyChange();
    }
  }

  public clear(): void {
    if (this.strokes.length === 0 && this.redoStack.length === 0) return;
    this.strokes = [];
    this.redoStack = [];
    this.render();
    this.notifyChange();
  }

  public destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.detachEventListeners();
  }

  private initCanvasSize(): void {
    this.dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(300, Math.floor(rect.width || this.canvas.parentElement?.clientWidth || 700));
    const height = Math.max(180, Math.floor(rect.height || this.canvas.parentElement?.clientHeight || 320));

    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Watch for responsive layout resizing
    if (window.ResizeObserver && this.canvas.parentElement) {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const newWidth = Math.floor(entry.contentRect.width);
          const newHeight = Math.floor(entry.contentRect.height);
          if (newWidth > 0 && newHeight > 0) {
            this.handleResize(newWidth, newHeight);
          }
        }
      });
      this.resizeObserver.observe(this.canvas.parentElement);
    }
  }

  private handleResize(cssWidth: number, cssHeight: number): void {
    const currentLogicalW = this.canvas.width / this.dpr;
    const currentLogicalH = this.canvas.height / this.dpr;

    if (Math.abs(cssWidth - currentLogicalW) < 2 && Math.abs(cssHeight - currentLogicalH) < 2) {
      return;
    }

    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(cssWidth * this.dpr);
    this.canvas.height = Math.round(cssHeight * this.dpr);
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;

    this.render();
  }

  private attachEventListeners(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerCancel);
    this.canvas.addEventListener('contextmenu', this.preventContextMenu);
  }

  private detachEventListeners(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
    this.canvas.removeEventListener('contextmenu', this.preventContextMenu);
  }

  private preventContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private getCanvasPoint(e: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      time: e.timeStamp || Date.now(),
      pressure: e.pressure,
    };
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0 && e.pointerType === 'mouse') return; // Left click only

    this.isDrawing = true;
    this.activePointerId = e.pointerId;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if setPointerCapture fails on certain mobile webviews
    }

    this.currentRawPoints = [this.getCanvasPoint(e)];
    this.redoStack = []; // Clear redo stack on new drawing action
    this.render();
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.isDrawing || (this.activePointerId !== null && e.pointerId !== this.activePointerId)) {
      return;
    }

    // Process coalesced events if available for ultra-smooth high-frequency inputs
    const coalesced = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const evt of coalesced) {
      this.currentRawPoints.push(this.getCanvasPoint(evt));
    }

    this.render();
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.isDrawing || (this.activePointerId !== null && e.pointerId !== this.activePointerId)) {
      return;
    }

    this.finishStroke();
  };

  private onPointerCancel = (): void => {
    if (!this.isDrawing) return;
    this.finishStroke();
  };

  private finishStroke(): void {
    this.isDrawing = false;
    if (this.activePointerId !== null) {
      try {
        this.canvas.releasePointerCapture(this.activePointerId);
      } catch {
        // Ignore
      }
      this.activePointerId = null;
    }

    if (this.currentRawPoints.length > 0) {
      const smoothed = smoothStrokePoints(
        this.currentRawPoints,
        this.config.strokeWidth,
        this.config.smoothingFactor,
        this.config.dynamicPressure
      );

      const stroke: Stroke = {
        id: `stroke-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        points: [...this.currentRawPoints],
        smoothedPoints: smoothed,
        color: this.config.strokeColor,
        baseWidth: this.config.strokeWidth,
        smoothingFactor: this.config.smoothingFactor,
        isDynamic: this.config.dynamicPressure,
      };

      this.strokes.push(stroke);
      this.currentRawPoints = [];
      this.render();
      this.notifyChange();
    }
  }

  private notifyChange(): void {
    if (this.onChange) {
      this.onChange();
    }
  }

  public render(): void {
    const logicalW = this.canvas.width / this.dpr;
    const logicalH = this.canvas.height / this.dpr;

    this.ctx.save();
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Clear canvas
    this.ctx.clearRect(0, 0, logicalW, logicalH);

    // Draw background
    if (this.config.backgroundType !== 'transparent' && this.config.backgroundColor) {
      this.ctx.fillStyle = this.config.backgroundColor;
      this.ctx.fillRect(0, 0, logicalW, logicalH);
    }

    // Optional subtle baseline guide (rendered only on canvas, never in export)
    if (this.config.showBaseline) {
      this.drawBaselineGuide(logicalW, logicalH);
    }

    // Draw completed strokes
    for (const stroke of this.strokes) {
      drawStrokeToContext(this.ctx, stroke);
    }

    // Draw active stroke being drawn in real time
    if (this.isDrawing && this.currentRawPoints.length > 0) {
      const activeSmoothed = smoothStrokePoints(
        this.currentRawPoints,
        this.config.strokeWidth,
        this.config.smoothingFactor,
        this.config.dynamicPressure
      );

      const activeStroke: Stroke = {
        id: 'active-stroke',
        points: this.currentRawPoints,
        smoothedPoints: activeSmoothed,
        color: this.config.strokeColor,
        baseWidth: this.config.strokeWidth,
        smoothingFactor: this.config.smoothingFactor,
        isDynamic: this.config.dynamicPressure,
      };

      drawStrokeToContext(this.ctx, activeStroke);
    }

    this.ctx.restore();
  }

  private drawBaselineGuide(width: number, height: number): void {
    const baselineY = Math.round(height * 0.72);
    const startX = Math.round(width * 0.08);
    const endX = Math.round(width * 0.92);

    this.ctx.save();
    this.ctx.strokeStyle = this.config.backgroundType === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([6, 6]);

    this.ctx.beginPath();
    this.ctx.moveTo(startX, baselineY);
    this.ctx.lineTo(endX, baselineY);
    this.ctx.stroke();

    // Subtle 'X' mark at start of baseline
    this.ctx.setLineDash([]);
    this.ctx.font = '14px sans-serif';
    this.ctx.fillStyle = this.config.backgroundType === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)';
    this.ctx.fillText('✕', startX - 22, baselineY + 4);

    this.ctx.restore();
  }

  public getCanvasDimensions(): { width: number; height: number } {
    return {
      width: Math.round(this.canvas.width / this.dpr),
      height: Math.round(this.canvas.height / this.dpr),
    };
  }
}

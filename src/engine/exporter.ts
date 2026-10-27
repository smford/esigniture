import { Stroke, BoundingBox, ExportFormat, SignatureConfig } from '../types';
import { getMidPoint, computeBoundingBox } from './smoothing';

export interface ExportOptions {
  canvasWidth: number;
  canvasHeight: number;
  config: SignatureConfig;
  format: ExportFormat;
}

export function measureTypedSignature(
  text: string,
  fontFamily: string,
  fontSize: number,
  canvasWidth: number,
  canvasHeight: number,
  padding = 20
): { bbox: BoundingBox; x: number; y: number } {
  let textWidth = text.length * fontSize * 0.55;
  let actualAscent = fontSize * 0.75;
  let actualDescent = fontSize * 0.25;

  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = `${fontSize}px "${fontFamily}", cursive, sans-serif`;
        const metrics = ctx.measureText(text);
        textWidth = Math.max(10, metrics.width);
        actualAscent = metrics.actualBoundingBoxAscent || fontSize * 0.75;
        actualDescent = metrics.actualBoundingBoxDescent || fontSize * 0.25;
      }
    } catch {
      // Fallback to estimated metrics
    }
  }

  const x = Math.max(padding + 10, (canvasWidth - textWidth) / 2);
  const y = (canvasHeight + actualAscent - actualDescent) / 2;

  const minX = Math.max(0, x - padding);
  const minY = Math.max(0, y - actualAscent - padding);
  const maxX = x + textWidth + padding;
  const maxY = y + actualDescent + padding;

  return {
    bbox: {
      minX: Math.floor(minX),
      minY: Math.floor(minY),
      maxX: Math.ceil(maxX),
      maxY: Math.ceil(maxY),
      width: Math.ceil(maxX - minX),
      height: Math.ceil(maxY - minY),
    },
    x,
    y,
  };
}

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
      const mid = getMidPoint(current, next);
      ctx.moveTo(mid.x - offsetX, mid.y - offsetY);
      ctx.lineTo(next.x - offsetX, next.y - offsetY);
    }

    ctx.stroke();
  }

  ctx.restore();
}

export function generateSvg(
  strokes: Stroke[],
  width: number,
  height: number,
  config: SignatureConfig,
  bbox: BoundingBox | null
): string {
  if (config.mode === 'type') {
    const typed = config.typedText.trim() || 'Signature';
    const textInfo = measureTypedSignature(typed, config.typedFont, config.typedFontSize, width, height, config.padding);
    const isTrimmed = config.trimWhitespace;
    const targetWidth = isTrimmed ? textInfo.bbox.width : width;
    const targetHeight = isTrimmed ? textInfo.bbox.height : height;
    const viewBoxX = isTrimmed ? textInfo.bbox.minX : 0;
    const viewBoxY = isTrimmed ? textInfo.bbox.minY : 0;

    let bgElement = '';
    if (config.backgroundType !== 'transparent' && config.backgroundColor) {
      bgElement = `  <rect x="${viewBoxX}" y="${viewBoxY}" width="${targetWidth}" height="${targetHeight}" fill="${config.backgroundColor}" />\n`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxX} ${viewBoxY} ${targetWidth} ${targetHeight}" width="${targetWidth}" height="${targetHeight}">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600&amp;family=Dancing+Script:wght@600&amp;family=Great+Vibes&amp;family=Sacramento&amp;display=swap');
    </style>
  </defs>
${bgElement}  <text x="${textInfo.x}" y="${textInfo.y}" font-family="'${config.typedFont}', cursive, sans-serif" font-size="${config.typedFontSize}px" fill="${config.strokeColor}">${typed}</text>
</svg>`;
  }

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

export function renderToOffscreenCanvas(
  strokes: Stroke[],
  originalWidth: number,
  originalHeight: number,
  config: SignatureConfig,
  bbox: BoundingBox | null
): HTMLCanvasElement {
  let isTrimmed = config.trimWhitespace && bbox !== null;
  let targetWidth = isTrimmed && bbox ? bbox.width : originalWidth;
  let targetHeight = isTrimmed && bbox ? bbox.height : originalHeight;
  let offsetX = isTrimmed && bbox ? bbox.minX : 0;
  let offsetY = isTrimmed && bbox ? bbox.minY : 0;

  let textInfo: { bbox: BoundingBox; x: number; y: number } | null = null;
  if (config.mode === 'type') {
    const typed = config.typedText.trim() || 'Signature';
    textInfo = measureTypedSignature(typed, config.typedFont, config.typedFontSize, originalWidth, originalHeight, config.padding);
    isTrimmed = config.trimWhitespace;
    targetWidth = isTrimmed ? textInfo.bbox.width : originalWidth;
    targetHeight = isTrimmed ? textInfo.bbox.height : originalHeight;
    offsetX = isTrimmed ? textInfo.bbox.minX : 0;
    offsetY = isTrimmed ? textInfo.bbox.minY : 0;
  }

  const canvas = document.createElement('canvas');
  const scale = 2; // supersampling
  canvas.width = Math.max(1, Math.round(targetWidth * scale));
  canvas.height = Math.max(1, Math.round(targetHeight * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D context for offscreen canvas');

  ctx.scale(scale, scale);

  if (config.backgroundType !== 'transparent' && config.backgroundColor) {
    ctx.fillStyle = config.backgroundColor;
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  } else if (config.backgroundType === 'transparent') {
    ctx.clearRect(0, 0, targetWidth, targetHeight);
  }

  if (config.mode === 'type' && textInfo) {
    ctx.font = `${config.typedFontSize}px "${config.typedFont}", cursive, sans-serif`;
    ctx.fillStyle = config.strokeColor;
    ctx.fillText(config.typedText.trim() || 'Signature', textInfo.x - offsetX, textInfo.y - offsetY);
  } else {
    for (const stroke of strokes) {
      drawStrokeToContext(ctx, stroke, offsetX, offsetY);
    }
  }

  return canvas;
}

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

export async function exportSignature(
  strokes: Stroke[],
  width: number,
  height: number,
  config: SignatureConfig,
  format: ExportFormat
): Promise<{ success: boolean; message: string }> {
  if (config.mode === 'draw' && strokes.length === 0) {
    return { success: false, message: 'Please draw a signature before downloading.' };
  }
  if (config.mode === 'type' && !config.typedText.trim()) {
    return { success: false, message: 'Please type your signature before downloading.' };
  }

  const bbox = config.mode === 'type'
    ? measureTypedSignature(config.typedText.trim(), config.typedFont, config.typedFontSize, width, height, config.padding).bbox
    : computeBoundingBox(strokes, config.padding);

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

export async function copySignatureToClipboard(
  strokes: Stroke[],
  width: number,
  height: number,
  config: SignatureConfig
): Promise<{ success: boolean; message: string }> {
  if (config.mode === 'draw' && strokes.length === 0) {
    return { success: false, message: 'Please draw a signature before copying.' };
  }
  if (config.mode === 'type' && !config.typedText.trim()) {
    return { success: false, message: 'Please type your signature before copying.' };
  }

  if (!navigator.clipboard || !window.ClipboardItem) {
    return { success: false, message: 'Clipboard image writing is not supported by your browser.' };
  }

  const bbox = config.mode === 'type'
    ? measureTypedSignature(config.typedText.trim(), config.typedFont, config.typedFontSize, width, height, config.padding).bbox
    : computeBoundingBox(strokes, config.padding);

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

export interface CleanerOptions {
  threshold: number; // 50 to 240 (default 190)
  contrast: number; // 0.8 to 2.5 (default 1.4)
  inkColor?: string; // hex color to recolor ink (optional)
  replaceWithInkColor: boolean;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const num = parseInt(cleanHex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Removes paper background and enhances ink contrast from a photo of a physical signature.
 */
export async function processSignatureImage(
  imageSource: HTMLImageElement | HTMLCanvasElement,
  options: CleanerOptions
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = imageSource.width;
  canvas.height = imageSource.height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.drawImage(imageSource, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  const threshold = options.threshold;
  const contrastFactor = options.contrast;
  const targetInkRgb = options.inkColor ? hexToRgb(options.inkColor) : { r: 15, g: 23, b: 42 };

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Standard perceptual luminance
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

    // Contrast stretching
    const stretched = Math.min(255, Math.max(0, (luminance - 128) * contrastFactor + 128));

    if (stretched >= threshold) {
      // Paper background -> 100% transparent
      data[i + 3] = 0;
    } else {
      // Ink pixel: calculate smooth alpha based on darkness
      const alphaFraction = (threshold - stretched) / threshold;
      const alpha = Math.min(255, Math.max(0, Math.round(Math.pow(alphaFraction, 0.7) * 255)));

      data[i + 3] = alpha;

      if (options.replaceWithInkColor) {
        data[i] = targetInkRgb.r;
        data[i + 1] = targetInkRgb.g;
        data[i + 2] = targetInkRgb.b;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Loads an image File into an HTMLImageElement.
 */
export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

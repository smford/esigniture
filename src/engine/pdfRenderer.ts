import * as pdfjsLib from 'pdfjs-dist';

// Configure worker safely
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
} catch (e) {
  console.warn('PDF.js worker initialization warning:', e);
}

export async function renderPdfPageToCanvas(
  file: File,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  maxWidth = 460
): Promise<{ width: number; height: number }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(pageNumber);

    const initialViewport = page.getViewport({ scale: 1.0 });
    const scale = Math.min(1.5, maxWidth / initialViewport.width);
    const viewport = page.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');

    await page.render({
      canvas,
      canvasContext: ctx,
      viewport,
    }).promise;

    return { width: viewport.width, height: viewport.height };
  } catch (err) {
    console.warn('PDF.js rendering fallback to simulated page:', err);
    // Offline / fallback simulated page rendering
    const width = maxWidth;
    const height = Math.round(maxWidth * 1.414); // A4 aspect
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Page border
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, width - 2, height - 2);

      // Simulated text lines
      ctx.fillStyle = '#f1f5f9';
      for (let y = 30; y < height - 60; y += 22) {
        const lineW = (y % 40 === 0) ? width * 0.6 : width * 0.82;
        ctx.fillRect(30, y, lineW, 8);
      }

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px sans-serif';
      ctx.fillText(`Page ${pageNumber} (${file.name})`, 30, height - 25);
    }

    return { width, height };
  }
}

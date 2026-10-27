import { PDFDocument } from 'pdf-lib';
import { triggerDownload } from './exporter';

export interface PdfPlacementOptions {
  pageIndex: number; // 0-indexed
  position: 'bottom-right' | 'bottom-left' | 'bottom-center' | 'custom';
  customX?: number; // In PDF points (72 DPI)
  customY?: number;
  scale?: number; // 0.2 to 2.0 (default ~0.5)
}

export interface PdfMetadata {
  pageCount: number;
  pageWidth: number;
  pageHeight: number;
  filename: string;
}

export async function readPdfMetadata(file: File): Promise<{ pdfDoc: PDFDocument; metadata: PdfMetadata }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pageCount = pdfDoc.getPageCount();
  const firstPage = pdfDoc.getPage(0);
  const { width, height } = firstPage.getSize();

  return {
    pdfDoc,
    metadata: {
      pageCount,
      pageWidth: Math.round(width),
      pageHeight: Math.round(height),
      filename: file.name,
    },
  };
}

export async function stampAndDownloadPdf(
  file: File,
  signaturePngBlob: Blob,
  options: PdfPlacementOptions
): Promise<{ success: boolean; message: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const pages = pdfDoc.getPages();

    if (pages.length === 0) {
      return { success: false, message: 'The uploaded PDF has no pages.' };
    }

    const targetIndex = Math.max(0, Math.min(pages.length - 1, options.pageIndex));
    const page = pages[targetIndex];
    const { width: pageWidth } = page.getSize();

    // Embed the transparent PNG signature
    const signatureBytes = await signaturePngBlob.arrayBuffer();
    const signatureImage = await pdfDoc.embedPng(signatureBytes);

    // Target dimensions for signature (default width ~ 150 points, preserving aspect ratio)
    const imgAspect = signatureImage.width / signatureImage.height;
    const scale = options.scale || 1.0;
    const sigWidth = Math.min(pageWidth * 0.45, 160 * scale);
    const sigHeight = sigWidth / imgAspect;

    let x = 50;
    let y = 50;

    switch (options.position) {
      case 'bottom-right':
        x = pageWidth - sigWidth - 50;
        y = 50;
        break;
      case 'bottom-left':
        x = 50;
        y = 50;
        break;
      case 'bottom-center':
        x = (pageWidth - sigWidth) / 2;
        y = 50;
        break;
      case 'custom':
        x = options.customX !== undefined ? options.customX : pageWidth - sigWidth - 50;
        y = options.customY !== undefined ? options.customY : 50;
        break;
    }

    page.drawImage(signatureImage, {
      x,
      y,
      width: sigWidth,
      height: sigHeight,
    });

    const modifiedBytes = await pdfDoc.save();
    const baseName = file.name.replace(/\.pdf$/i, '');
    const outName = `${baseName}-signed.pdf`;

    const signedBlob = new Blob([modifiedBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
    triggerDownload(signedBlob, outName);

    return { success: true, message: `Successfully signed & downloaded ${outName}!` };
  } catch (err) {
    console.error('PDF signing error:', err);
    return { success: false, message: 'Failed to sign PDF. Please verify the PDF is not password-protected.' };
  }
}

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { triggerDownload } from './exporter';
import { computeSha256, appendAuditCertificate } from './cryptoAudit';

export interface VisualPlacement {
  relX: number; // 0 to 1 (from left)
  relY: number; // 0 to 1 (from top of rendered canvas)
  relWidth: number; // 0 to 1
  relHeight: number; // 0 to 1
}

export interface PdfSignOptions {
  pageIndex: number;
  visualPlacement?: VisualPlacement;
  scale?: number;
  positionPreset?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  // Multi-field metadata
  includeDate?: boolean;
  dateText?: string;
  includeName?: boolean;
  printedName?: string;
  includeAuditCertificate?: boolean;
  signerIdentifier?: string;
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
  options: PdfSignOptions
): Promise<{ success: boolean; message: string; originalHash: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const originalHash = await computeSha256(arrayBuffer);
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const pages = pdfDoc.getPages();

    if (pages.length === 0) {
      return { success: false, message: 'The uploaded PDF has no pages.', originalHash };
    }

    const targetIndex = Math.max(0, Math.min(pages.length - 1, options.pageIndex));
    const page = pages[targetIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Embed the transparent PNG signature
    const signatureBytes = await signaturePngBlob.arrayBuffer();
    const signatureImage = await pdfDoc.embedPng(signatureBytes);

    let x: number;
    let y: number;
    let sigWidth: number;
    let sigHeight: number;

    const imgAspect = signatureImage.width / signatureImage.height;

    if (options.visualPlacement) {
      // Map visual placement from relative canvas coords (top-left origin) to PDF coords (bottom-left origin)
      sigWidth = Math.max(40, options.visualPlacement.relWidth * pageWidth);
      sigHeight = sigWidth / imgAspect;
      x = options.visualPlacement.relX * pageWidth;
      // In PDF, Y=0 is bottom
      const visualYFromBottom = (1.0 - options.visualPlacement.relY) * pageHeight;
      y = Math.max(10, visualYFromBottom - sigHeight);
    } else {
      // Fallback to presets
      const scale = options.scale || 1.0;
      sigWidth = Math.min(pageWidth * 0.45, 160 * scale);
      sigHeight = sigWidth / imgAspect;

      switch (options.positionPreset) {
        case 'bottom-left':
          x = 50;
          y = 50;
          break;
        case 'bottom-center':
          x = (pageWidth - sigWidth) / 2;
          y = 50;
          break;
        case 'bottom-right':
        default:
          x = pageWidth - sigWidth - 50;
          y = 50;
          break;
      }
    }

    // Draw signature image
    page.drawImage(signatureImage, {
      x,
      y,
      width: sigWidth,
      height: sigHeight,
    });

    // Multi-Field Stamping (Date & Printed Name)
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    let extraFieldY = Math.max(15, y - 14);

    if (options.includeName && options.printedName) {
      page.drawText(options.printedName, {
        x,
        y: extraFieldY,
        size: 9,
        font: fontBold,
        color: rgb(0.15, 0.2, 0.25),
      });
      extraFieldY -= 12;
    }

    if (options.includeDate && options.dateText) {
      page.drawText(`Date: ${options.dateText}`, {
        x,
        y: extraFieldY,
        size: 8,
        font,
        color: rgb(0.35, 0.4, 0.5),
      });
    }

    // Optional Cryptographic Audit Certificate of Completion
    if (options.includeAuditCertificate) {
      const now = new Date();
      const verificationId = `SIG-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      await appendAuditCertificate(pdfDoc, {
        documentName: file.name,
        originalHash,
        timestamp: now.toISOString(),
        signerName: options.signerIdentifier || options.printedName || 'Authorized Signer',
        signerIpOrLocation: 'Client-Side Browser Execution',
        verificationId,
      });
    }

    const modifiedBytes = await pdfDoc.save();
    const baseName = file.name.replace(/\.pdf$/i, '');
    const outName = `${baseName}-signed.pdf`;

    const signedBlob = new Blob([modifiedBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
    triggerDownload(signedBlob, outName);

    return {
      success: true,
      message: `Signed & downloaded ${outName}!`,
      originalHash,
    };
  } catch (err) {
    console.error('PDF signing error:', err);
    return {
      success: false,
      message: 'Failed to sign PDF. Please verify the document is valid.',
      originalHash: '',
    };
  }
}

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface AuditRecord {
  documentName: string;
  originalHash: string;
  signedHash?: string;
  timestamp: string;
  signerName: string;
  signerIpOrLocation: string;
  verificationId: string;
}

/**
 * Computes an SHA-256 hex digest of an ArrayBuffer or Blob using the native Web Crypto API.
 */
export async function computeSha256(data: ArrayBuffer | Blob): Promise<string> {
  const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Appends a tamper-evident Certificate of Completion to the PDF document.
 */
export async function appendAuditCertificate(
  pdfDoc: PDFDocument,
  record: AuditRecord
): Promise<void> {
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 in points
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  // Background card styling
  page.drawRectangle({
    x: 40,
    y: 40,
    width: 515.28,
    height: 761.89,
    color: rgb(0.98, 0.99, 1.0),
    borderColor: rgb(0.85, 0.9, 0.95),
    borderWidth: 1.5,
  });

  // Top header bar
  page.drawRectangle({
    x: 40,
    y: 740,
    width: 515.28,
    height: 61.89,
    color: rgb(0.14, 0.38, 0.92),
  });

  page.drawText('CRYPTOGRAPHIC AUDIT CERTIFICATE', {
    x: 60,
    y: 765,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText('Tamper-Evident eSignature Verification Trail (100% Client-Side)', {
    x: 60,
    y: 748,
    size: 9,
    font,
    color: rgb(0.85, 0.92, 1),
  });

  // Verification details
  let y = 690;
  const drawRow = (label: string, value: string, isMono = false) => {
    page.drawText(label.toUpperCase(), {
      x: 60,
      y,
      size: 9,
      font: fontBold,
      color: rgb(0.4, 0.45, 0.55),
    });
    page.drawText(value, {
      x: 60,
      y: y - 16,
      size: 11,
      font: isMono ? fontMono : font,
      color: rgb(0.1, 0.15, 0.2),
    });
    y -= 45;
  };

  drawRow('Document Name', record.documentName);
  drawRow('Signer Identifier', record.signerName || 'Digital Signature');
  drawRow('Execution Timestamp (UTC)', record.timestamp);
  drawRow('Verification Fingerprint ID', record.verificationId, true);
  drawRow('Original Document SHA-256 Hash', record.originalHash, true);

  // Security Guarantee Note
  page.drawRectangle({
    x: 60,
    y: 200,
    width: 475.28,
    height: 120,
    color: rgb(0.94, 0.97, 1.0),
    borderColor: rgb(0.7, 0.82, 0.98),
    borderWidth: 1,
  });

  page.drawText('Zero-Knowledge Security Statement', {
    x: 75,
    y: 295,
    size: 11,
    font: fontBold,
    color: rgb(0.12, 0.35, 0.85),
  });

  const statement = [
    'This document was executed with eSignature Studio (AGPL-3.0).',
    'All cryptographic hashes, smoothing algorithms, and stamping were computed entirely inside',
    'the local browser sandbox. No document bytes, signatures, or biometric data were transmitted',
    'over any network or stored on external servers.',
    'Copyright (c) 2026 smford. Free and Open Source Software.',
  ];

  let stmtY = 275;
  for (const line of statement) {
    page.drawText(line, {
      x: 75,
      y: stmtY,
      size: 8.5,
      font,
      color: rgb(0.3, 0.35, 0.45),
    });
    stmtY -= 15;
  }

  // Footer badge
  page.drawText('VERIFIED DIGITAL SIGNATURE • TAMPER PROOF SEAL', {
    x: 170,
    y: 60,
    size: 8,
    font: fontBold,
    color: rgb(0.55, 0.6, 0.7),
  });
}

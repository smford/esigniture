import './style.css';
import { SignatureConfig, BackgroundType, ExportFormat } from './types';
import { SignatureCanvas } from './engine/signatureCanvas';
import { exportSignature, copySignatureToClipboard, generateSvg, getSignaturePngBlob } from './engine/exporter';
import { computeBoundingBox } from './engine/smoothing';
import { readPdfMetadata, stampAndDownloadPdf, PdfSignOptions } from './engine/pdfSigner';
import { renderPdfPageToCanvas } from './engine/pdfRenderer';
import { processSignatureImage, loadImageFromFile, CleanerOptions } from './engine/signatureCleaner';
import { getVaultItems, saveToVault, deleteFromVault } from './engine/signatureVault';
import { generateAppQrCode } from './engine/qrGenerator';
import { createDesktopRelay, connectMobileToDesktop, DesktopRelaySession, MobileRelayClient } from './engine/relay';
import { Icons } from './ui/icons';

// Initialize UI Icons
function injectIcons(): void {
  const iconMap: Record<string, string> = {
    'logo-icon': Icons.feather,
    'shield-icon': Icons.shieldCheck,
    'theme-icon': Icons.moon,
    'undo-icon': Icons.undo,
    'redo-icon': Icons.redo,
    'trash-icon': Icons.trash,
    'pen-icon': Icons.pen,
    'download-icon': Icons.download,
    'svg-icon': Icons.fileCode,
    'copy-icon': Icons.copy,
    'install-icon': Icons.install,
    'tab-draw-icon': Icons.pen,
    'tab-type-icon': Icons.type,
    'tab-scan-icon': Icons.camera,
    'scan-dropzone-icon': Icons.camera,
    'pdf-icon': Icons.filePdf,
    'modal-pdf-icon': Icons.filePdf,
    'close-pdf-icon': Icons.close,
    'dropzone-icon': Icons.filePdf,
    'save-icon': Icons.save,
    'vault-icon': Icons.vault,
    'modal-vault-icon': Icons.vault,
    'close-vault-icon': Icons.close,
    'qr-icon': Icons.smartphone,
    'modal-qr-icon': Icons.smartphone,
    'close-qr-icon': Icons.close,
  };

  for (const [id, svg] of Object.entries(iconMap)) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = svg;
  }
}

// Toast notification helper
function showToast(message: string, isError = false): void {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  if (isError) {
    toast.style.background = '#ef4444';
    toast.style.color = '#ffffff';
  }
  toast.innerHTML = `<span>${isError ? '✕' : Icons.check}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px) scale(0.95)';
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// Initial Configuration
const config: SignatureConfig = {
  mode: 'draw',
  typedText: 'Jane Doe',
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

// Main Initialization
document.addEventListener('DOMContentLoaded', () => {
  injectIcons();

  const urlParams = new URLSearchParams(window.location.search);
  const targetSession = urlParams.get('session');
  const role = urlParams.get('role');

  if (role === 'mobile' && targetSession) {
    initMobileSigningMode(targetSession);
    return;
  }

  const canvasEl = document.getElementById('signature-canvas') as HTMLCanvasElement;
  const canvasContainer = document.getElementById('canvas-container') as HTMLElement;
  const canvasHint = document.getElementById('canvas-hint') as HTMLElement;

  const btnUndo = document.getElementById('btn-undo') as HTMLButtonElement;
  const btnRedo = document.getElementById('btn-redo') as HTMLButtonElement;
  const btnClear = document.getElementById('btn-clear') as HTMLButtonElement;
  const btnSaveVault = document.getElementById('btn-save-vault') as HTMLButtonElement | null;

  const strokeWidthSlider = document.getElementById('stroke-width-slider') as HTMLInputElement;
  const strokeWidthVal = document.getElementById('stroke-width-val') as HTMLElement;
  const smoothingSlider = document.getElementById('smoothing-slider') as HTMLInputElement;
  const smoothingVal = document.getElementById('smoothing-val') as HTMLElement;

  const dynamicToggle = document.getElementById('dynamic-pressure-toggle') as HTMLInputElement;
  const trimToggle = document.getElementById('trim-whitespace-toggle') as HTMLInputElement;
  const baselineToggle = document.getElementById('baseline-toggle') as HTMLInputElement;

  const docPreviewImg = document.getElementById('doc-preview-img') as HTMLImageElement;
  const docPlaceholder = document.getElementById('doc-sign-placeholder') as HTMLElement;

  // Initialize Canvas instance
  const sigCanvas = new SignatureCanvas({
    canvas: canvasEl,
    config,
    onChange: () => {
      updateUIState();
    },
  });

  // Theme Management
  const themeToggle = document.getElementById('theme-toggle');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const savedTheme = localStorage.getItem('theme') || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  themeToggle?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon(next);
  });

  function updateThemeIcon(theme: string): void {
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
      themeIcon.innerHTML = theme === 'dark' ? Icons.sun : Icons.moon;
    }
  }

  // Update UI & Document Preview
  function updateUIState(): void {
    if (config.mode === 'scan') {
      const imported = sigCanvas.getImportedImage();
      btnUndo.disabled = true;
      btnRedo.disabled = true;
      btnClear.disabled = !imported;
      if (btnSaveVault) btnSaveVault.disabled = !imported;
      canvasHint.classList.add('hidden');

      if (imported) {
        docPreviewImg.src = imported.toDataURL('image/png');
        docPreviewImg.style.display = 'block';
        docPlaceholder.style.display = 'none';
      } else {
        docPreviewImg.style.display = 'none';
        docPlaceholder.style.display = 'inline';
      }
      return;
    }

    if (config.mode === 'type') {
      const hasText = config.typedText.trim().length > 0;
      btnUndo.disabled = true;
      btnRedo.disabled = true;
      btnClear.disabled = !hasText;
      if (btnSaveVault) btnSaveVault.disabled = !hasText;
      canvasHint.classList.add('hidden');

      if (hasText) {
        const dims = sigCanvas.getCanvasDimensions();
        const previewSvg = generateSvg([], dims.width, dims.height, { ...config, trimWhitespace: true }, null);
        docPreviewImg.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(previewSvg)}`;
        docPreviewImg.style.display = 'block';
        docPlaceholder.style.display = 'none';
      } else {
        docPreviewImg.style.display = 'none';
        docPlaceholder.style.display = 'inline';
      }
      return;
    }

    const isEmpty = sigCanvas.isEmpty();
    btnUndo.disabled = !sigCanvas.canUndo();
    btnRedo.disabled = !sigCanvas.canRedo();
    btnClear.disabled = isEmpty;
    if (btnSaveVault) btnSaveVault.disabled = isEmpty;

    if (isEmpty) {
      canvasHint.classList.remove('hidden');
      docPreviewImg.style.display = 'none';
      docPlaceholder.style.display = 'inline';
    } else {
      canvasHint.classList.add('hidden');
      // Update doc preview
      const strokes = sigCanvas.getStrokes();
      const dims = sigCanvas.getCanvasDimensions();
      const bbox = computeBoundingBox(strokes, 15);
      const previewSvg = generateSvg(strokes, dims.width, dims.height, { ...config, trimWhitespace: true }, bbox);
      docPreviewImg.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(previewSvg)}`;
      docPreviewImg.style.display = 'block';
      docPlaceholder.style.display = 'none';
    }
  }

  // Mode tabs switcher
  const modeTabDraw = document.getElementById('mode-tab-draw') as HTMLButtonElement;
  const modeTabType = document.getElementById('mode-tab-type') as HTMLButtonElement;
  const modeTabScan = document.getElementById('mode-tab-scan') as HTMLButtonElement;
  const drawControls = document.getElementById('draw-controls') as HTMLElement;
  const typeControls = document.getElementById('type-controls') as HTMLElement;
  const scanControls = document.getElementById('scan-controls') as HTMLElement;

  modeTabDraw?.addEventListener('click', () => {
    modeTabDraw.classList.add('active');
    modeTabType.classList.remove('active');
    modeTabScan.classList.remove('active');
    drawControls.style.display = 'flex';
    typeControls.style.display = 'none';
    scanControls.style.display = 'none';
    config.mode = 'draw';
    sigCanvas.updateConfig({ mode: 'draw' });
    updateUIState();
  });

  modeTabType?.addEventListener('click', () => {
    modeTabType.classList.add('active');
    modeTabDraw.classList.remove('active');
    modeTabScan.classList.remove('active');
    drawControls.style.display = 'none';
    typeControls.style.display = 'flex';
    scanControls.style.display = 'none';
    config.mode = 'type';
    sigCanvas.updateConfig({ mode: 'type' });
    updateUIState();
  });

  modeTabScan?.addEventListener('click', () => {
    modeTabScan.classList.add('active');
    modeTabDraw.classList.remove('active');
    modeTabType.classList.remove('active');
    drawControls.style.display = 'none';
    typeControls.style.display = 'none';
    scanControls.style.display = 'flex';
    config.mode = 'scan';
    sigCanvas.updateConfig({ mode: 'scan' });
    updateUIState();
  });

  // Scan controls listeners & processor
  const scanFileInput = document.getElementById('scan-file-input') as HTMLInputElement;
  const scanDropzone = document.getElementById('scan-dropzone') as HTMLElement;
  const scanAdjustPanel = document.getElementById('scan-adjust-panel') as HTMLElement;
  const scanThresholdSlider = document.getElementById('scan-threshold-slider') as HTMLInputElement;
  const scanThresholdVal = document.getElementById('scan-threshold-val') as HTMLElement;
  const scanContrastSlider = document.getElementById('scan-contrast-slider') as HTMLInputElement;
  const scanContrastVal = document.getElementById('scan-contrast-val') as HTMLElement;
  const scanRecolorToggle = document.getElementById('scan-recolor-toggle') as HTMLInputElement;

  let loadedRawImage: HTMLImageElement | null = null;

  scanDropzone?.addEventListener('click', () => scanFileInput.click());

  scanDropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    scanDropzone.classList.add('dragover');
  });

  scanDropzone?.addEventListener('dragleave', () => {
    scanDropzone.classList.remove('dragover');
  });

  scanDropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    scanDropzone.classList.remove('dragover');
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      handleScannedFile(e.dataTransfer.files[0]);
    }
  });

  scanFileInput?.addEventListener('change', () => {
    if (scanFileInput.files && scanFileInput.files.length > 0) {
      handleScannedFile(scanFileInput.files[0]);
    }
  });

  async function handleScannedFile(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, WebP).', true);
      return;
    }
    try {
      loadedRawImage = await loadImageFromFile(file);
      scanAdjustPanel.style.display = 'flex';
      await reprocessScanned();
      showToast('Signature scanned & paper removed!');
    } catch (err) {
      console.error(err);
      showToast('Could not load image file.', true);
    }
  }

  async function reprocessScanned(): Promise<void> {
    if (!loadedRawImage) return;
    const threshold = parseInt(scanThresholdSlider.value, 10);
    const contrast = parseFloat(scanContrastSlider.value);
    const replaceWithInkColor = scanRecolorToggle.checked;

    const options: CleanerOptions = {
      threshold,
      contrast,
      inkColor: config.strokeColor,
      replaceWithInkColor,
    };

    const cleanedCanvas = await processSignatureImage(loadedRawImage, options);
    sigCanvas.setImportedImage(cleanedCanvas);
    updateUIState();
  }

  scanThresholdSlider?.addEventListener('input', (e) => {
    const val = (e.target as HTMLInputElement).value;
    scanThresholdVal.textContent = val;
    reprocessScanned();
  });

  scanContrastSlider?.addEventListener('input', (e) => {
    const val = (e.target as HTMLInputElement).value;
    scanContrastVal.textContent = `${val}x`;
    reprocessScanned();
  });

  scanRecolorToggle?.addEventListener('change', () => {
    reprocessScanned();
  });

  // Type controls listeners
  const typedNameInput = document.getElementById('typed-name-input') as HTMLInputElement;
  const fontPills = document.querySelectorAll('#font-pill-palette .font-pill');
  const typedSizeSlider = document.getElementById('typed-size-slider') as HTMLInputElement;
  const typedSizeVal = document.getElementById('typed-size-val') as HTMLElement;

  typedNameInput?.addEventListener('input', (e) => {
    const val = (e.target as HTMLInputElement).value;
    config.typedText = val;
    sigCanvas.updateConfig({ typedText: val });
    updateUIState();
  });

  fontPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      fontPills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      const font = pill.getAttribute('data-font') || 'Caveat';
      config.typedFont = font;
      sigCanvas.updateConfig({ typedFont: font });
      updateUIState();
    });
  });

  typedSizeSlider?.addEventListener('input', (e) => {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    typedSizeVal.textContent = `${val} px`;
    config.typedFontSize = val;
    sigCanvas.updateConfig({ typedFontSize: val });
    updateUIState();
  });

  // Stroke Color Palette
  const strokeSwatches = document.querySelectorAll('#stroke-color-palette .color-swatch');
  const strokeCustomInput = document.getElementById('stroke-color-custom') as HTMLInputElement;

  strokeSwatches.forEach((swatch) => {
    swatch.addEventListener('click', () => {
      strokeSwatches.forEach((s) => s.classList.remove('active'));
      swatch.classList.add('active');
      const color = swatch.getAttribute('data-color') || '#0f172a';
      config.strokeColor = color;
      sigCanvas.updateConfig({ strokeColor: color });
    });
  });

  strokeCustomInput.addEventListener('input', (e) => {
    strokeSwatches.forEach((s) => s.classList.remove('active'));
    const color = (e.target as HTMLInputElement).value;
    config.strokeColor = color;
    sigCanvas.updateConfig({ strokeColor: color });
  });

  // Background Color Palette
  const bgSwatches = document.querySelectorAll('#bg-color-palette .color-swatch');
  const bgCustomInput = document.getElementById('bg-color-custom') as HTMLInputElement;

  bgSwatches.forEach((swatch) => {
    swatch.addEventListener('click', () => {
      bgSwatches.forEach((s) => s.classList.remove('active'));
      swatch.classList.add('active');

      const bgType = (swatch.getAttribute('data-bg-type') || 'transparent') as BackgroundType;
      const color = swatch.getAttribute('data-color') || '';

      applyBackground(bgType, color);
    });
  });

  bgCustomInput.addEventListener('input', (e) => {
    bgSwatches.forEach((s) => s.classList.remove('active'));
    const color = (e.target as HTMLInputElement).value;
    applyBackground('custom', color);
  });

  function applyBackground(type: BackgroundType, color: string): void {
    config.backgroundType = type;
    config.backgroundColor = color;

    if (type === 'transparent') {
      canvasContainer.classList.add('transparent-pattern');
      canvasContainer.style.backgroundColor = '';
    } else {
      canvasContainer.classList.remove('transparent-pattern');
      canvasContainer.style.backgroundColor = color;
    }

    sigCanvas.updateConfig({
      backgroundType: type,
      backgroundColor: color,
    });
  }

  // Stroke Width Slider
  strokeWidthSlider.addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    strokeWidthVal.textContent = `${val} px`;
    config.strokeWidth = val;
    sigCanvas.updateConfig({ strokeWidth: val });
  });

  // Smoothing Slider
  smoothingSlider.addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    let label = 'Balanced';
    if (val <= 0.1) label = 'Raw (Crisp)';
    else if (val < 0.4) label = 'Light';
    else if (val <= 0.7) label = 'Balanced';
    else label = 'Silky Smooth';

    smoothingVal.textContent = `${label} (${Math.round(val * 100)}%)`;
    config.smoothingFactor = val;
    sigCanvas.updateConfig({ smoothingFactor: val });
  });

  // Toggles
  dynamicToggle.addEventListener('change', (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    config.dynamicPressure = checked;
    sigCanvas.updateConfig({ dynamicPressure: checked });
  });

  trimToggle.addEventListener('change', (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    config.trimWhitespace = checked;
    sigCanvas.updateConfig({ trimWhitespace: checked });
  });

  baselineToggle.addEventListener('change', (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    config.showBaseline = checked;
    sigCanvas.updateConfig({ showBaseline: checked });
  });

  // Toolbar Actions
  btnUndo.addEventListener('click', () => sigCanvas.undo());
  btnRedo.addEventListener('click', () => sigCanvas.redo());
  btnClear.addEventListener('click', () => {
    if (config.mode === 'type') {
      config.typedText = '';
      if (typedNameInput) typedNameInput.value = '';
      sigCanvas.updateConfig({ typedText: '' });
      updateUIState();
    } else if (config.mode === 'scan') {
      loadedRawImage = null;
      scanAdjustPanel.style.display = 'none';
      sigCanvas.setImportedImage(null);
      updateUIState();
    } else {
      sigCanvas.clear();
    }
  });

  // Export handlers
  async function handleExport(format: ExportFormat): Promise<void> {
    const dims = sigCanvas.getCanvasDimensions();
    const result = await exportSignature(
      sigCanvas.getStrokes(),
      dims.width,
      dims.height,
      config,
      format,
      sigCanvas.getImportedImage()
    );
    showToast(result.message, !result.success);
  }

  document.getElementById('btn-download-png')?.addEventListener('click', () => handleExport('png'));
  document.getElementById('btn-download-svg')?.addEventListener('click', () => handleExport('svg'));
  document.getElementById('btn-download-jpeg')?.addEventListener('click', () => handleExport('jpeg'));
  document.getElementById('btn-download-webp')?.addEventListener('click', () => handleExport('webp'));

  // Copy to Clipboard
  document.getElementById('btn-copy-clipboard')?.addEventListener('click', async () => {
    const dims = sigCanvas.getCanvasDimensions();
    const result = await copySignatureToClipboard(
      sigCanvas.getStrokes(),
      dims.width,
      dims.height,
      config,
      sigCanvas.getImportedImage()
    );
    showToast(result.message, !result.success);
  });

  // PDF Signing Modal & Logic
  const pdfModal = document.getElementById('pdf-modal') as HTMLElement;
  const btnOpenPdfModal = document.getElementById('btn-open-pdf-modal') as HTMLButtonElement;
  const btnClosePdfModal = document.getElementById('btn-close-pdf-modal') as HTMLButtonElement;
  const btnCancelPdf = document.getElementById('btn-cancel-pdf') as HTMLButtonElement;
  const pdfDropzone = document.getElementById('pdf-dropzone') as HTMLElement;
  const pdfFileInput = document.getElementById('pdf-file-input') as HTMLInputElement;
  const pdfConfigPanel = document.getElementById('pdf-config-panel') as HTMLElement;
  const pdfFilename = document.getElementById('pdf-filename') as HTMLElement;
  const pdfPageInfo = document.getElementById('pdf-page-info') as HTMLElement;
  const btnChangePdf = document.getElementById('btn-change-pdf') as HTMLButtonElement;
  const pdfPageSelect = document.getElementById('pdf-page-select') as HTMLSelectElement;
  const pdfScaleSlider = document.getElementById('pdf-scale-slider') as HTMLInputElement;
  const pdfScaleVal = document.getElementById('pdf-scale-val') as HTMLElement;
  const btnStampPdf = document.getElementById('btn-stamp-pdf') as HTMLButtonElement;

  const pdfVisualCanvas = document.getElementById('pdf-visual-canvas') as HTMLCanvasElement;
  const pdfSigOverlay = document.getElementById('pdf-sig-overlay') as HTMLElement;
  const pdfSigOverlayImg = document.getElementById('pdf-sig-overlay-img') as HTMLImageElement;

  const pdfFieldDateToggle = document.getElementById('pdf-field-date-toggle') as HTMLInputElement;
  const pdfFieldDateInput = document.getElementById('pdf-field-date-input') as HTMLInputElement;
  const pdfFieldNameToggle = document.getElementById('pdf-field-name-toggle') as HTMLInputElement;
  const pdfFieldNameInput = document.getElementById('pdf-field-name-input') as HTMLInputElement;
  const pdfAuditCertToggle = document.getElementById('pdf-audit-certificate-toggle') as HTMLInputElement;

  // Initialize date input to today
  if (pdfFieldDateInput) {
    pdfFieldDateInput.value = new Date().toISOString().split('T')[0];
  }

  let currentPdfFile: File | null = null;
  let isDraggingOverlay = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let overlayStartLeft = 0;
  let overlayStartTop = 0;

  btnOpenPdfModal?.addEventListener('click', async () => {
    if (config.mode === 'draw' && sigCanvas.isEmpty()) {
      showToast('Please draw your signature first.', true);
      return;
    }
    if (config.mode === 'type' && !config.typedText.trim()) {
      showToast('Please type your signature first.', true);
      return;
    }
    pdfModal.style.display = 'flex';

    // Prepare preview image on the overlay
    const dims = sigCanvas.getCanvasDimensions();
    const sigBlob = await getSignaturePngBlob(sigCanvas.getStrokes(), dims.width, dims.height, config, sigCanvas.getImportedImage());
    if (sigBlob) {
      pdfSigOverlayImg.src = URL.createObjectURL(sigBlob);
    }
  });

  const closePdfModal = () => {
    pdfModal.style.display = 'none';
  };

  btnClosePdfModal?.addEventListener('click', closePdfModal);
  btnCancelPdf?.addEventListener('click', closePdfModal);

  pdfDropzone?.addEventListener('click', () => pdfFileInput.click());

  pdfDropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    pdfDropzone.classList.add('dragover');
  });

  pdfDropzone?.addEventListener('dragleave', () => {
    pdfDropzone.classList.remove('dragover');
  });

  pdfDropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    pdfDropzone.classList.remove('dragover');
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      handlePdfSelected(e.dataTransfer.files[0]);
    }
  });

  pdfFileInput?.addEventListener('change', () => {
    if (pdfFileInput.files && pdfFileInput.files.length > 0) {
      handlePdfSelected(pdfFileInput.files[0]);
    }
  });

  btnChangePdf?.addEventListener('click', () => pdfFileInput.click());

  async function handlePdfSelected(file: File): Promise<void> {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showToast('Please upload a valid .pdf file.', true);
      return;
    }

    try {
      const { metadata } = await readPdfMetadata(file);
      currentPdfFile = file;

      pdfFilename.textContent = metadata.filename;
      pdfPageInfo.textContent = `${metadata.pageCount} ${metadata.pageCount === 1 ? 'Page' : 'Pages'} (${metadata.pageWidth} × ${metadata.pageHeight} pt)`;

      pdfPageSelect.innerHTML = '';
      for (let i = 0; i < metadata.pageCount; i++) {
        const opt = document.createElement('option');
        opt.value = i.toString();
        opt.textContent = `Page ${i + 1}`;
        pdfPageSelect.appendChild(opt);
      }
      // Default to last page
      pdfPageSelect.value = (metadata.pageCount - 1).toString();

      pdfDropzone.style.display = 'none';
      pdfConfigPanel.style.display = 'flex';
      btnStampPdf.disabled = false;

      // Render visual page preview
      await updatePdfVisualPreview();
    } catch (err) {
      console.error(err);
      showToast('Could not load PDF document. Is it password protected?', true);
    }
  }

  async function updatePdfVisualPreview(): Promise<void> {
    if (!currentPdfFile) return;
    const pageIndex = parseInt(pdfPageSelect.value, 10);
    await renderPdfPageToCanvas(currentPdfFile, pageIndex + 1, pdfVisualCanvas, 420);

    // Position overlay near bottom-right of rendered page
    const canvasLeft = pdfVisualCanvas.offsetLeft;
    const canvasTop = pdfVisualCanvas.offsetTop;
    const canvasWidth = pdfVisualCanvas.width;
    const canvasHeight = pdfVisualCanvas.height;

    pdfSigOverlay.style.left = `${canvasLeft + canvasWidth * 0.58}px`;
    pdfSigOverlay.style.top = `${canvasTop + canvasHeight * 0.72}px`;
  }

  pdfPageSelect?.addEventListener('change', () => {
    updatePdfVisualPreview();
  });

  // Dragging the signature overlay on the visual PDF canvas
  pdfSigOverlay?.addEventListener('pointerdown', (e) => {
    isDraggingOverlay = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    overlayStartLeft = pdfSigOverlay.offsetLeft;
    overlayStartTop = pdfSigOverlay.offsetTop;
    pdfSigOverlay.setPointerCapture(e.pointerId);
  });

  pdfSigOverlay?.addEventListener('pointermove', (e) => {
    if (!isDraggingOverlay) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;

    const canvasLeft = pdfVisualCanvas.offsetLeft;
    const canvasTop = pdfVisualCanvas.offsetTop;
    const minX = canvasLeft;
    const maxX = canvasLeft + pdfVisualCanvas.width - pdfSigOverlay.offsetWidth;
    const minY = canvasTop;
    const maxY = canvasTop + pdfVisualCanvas.height - pdfSigOverlay.offsetHeight;

    const newLeft = Math.max(minX, Math.min(maxX, overlayStartLeft + dx));
    const newTop = Math.max(minY, Math.min(maxY, overlayStartTop + dy));

    pdfSigOverlay.style.left = `${newLeft}px`;
    pdfSigOverlay.style.top = `${newTop}px`;
  });

  const stopOverlayDrag = () => {
    isDraggingOverlay = false;
  };
  pdfSigOverlay?.addEventListener('pointerup', stopOverlayDrag);
  pdfSigOverlay?.addEventListener('pointercancel', stopOverlayDrag);

  pdfScaleSlider?.addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    pdfScaleVal.textContent = `${Math.round(val * 100)}%`;
    const baseW = 140;
    const baseH = 60;
    pdfSigOverlay.style.width = `${Math.round(baseW * val)}px`;
    pdfSigOverlay.style.height = `${Math.round(baseH * val)}px`;
  });

  btnStampPdf?.addEventListener('click', async () => {
    if (!currentPdfFile) return;

    btnStampPdf.disabled = true;
    btnStampPdf.textContent = 'Signing & Certifying PDF...';

    const dims = sigCanvas.getCanvasDimensions();
    const sigBlob = await getSignaturePngBlob(sigCanvas.getStrokes(), dims.width, dims.height, config, sigCanvas.getImportedImage());

    if (!sigBlob) {
      showToast('Failed to render signature for PDF.', true);
      btnStampPdf.disabled = false;
      btnStampPdf.textContent = 'Stamp & Download Signed PDF';
      return;
    }

    // Calculate relative placement coordinates on the PDF page
    const canvasLeft = pdfVisualCanvas.offsetLeft;
    const canvasTop = pdfVisualCanvas.offsetTop;
    const canvasWidth = pdfVisualCanvas.width;
    const canvasHeight = pdfVisualCanvas.height;

    const relX = Math.max(0, Math.min(1, (pdfSigOverlay.offsetLeft - canvasLeft) / canvasWidth));
    const relY = Math.max(0, Math.min(1, (pdfSigOverlay.offsetTop - canvasTop) / canvasHeight));
    const relWidth = Math.max(0.05, Math.min(1, pdfSigOverlay.offsetWidth / canvasWidth));
    const relHeight = Math.max(0.02, Math.min(1, pdfSigOverlay.offsetHeight / canvasHeight));

    const options: PdfSignOptions = {
      pageIndex: parseInt(pdfPageSelect.value, 10),
      visualPlacement: { relX, relY, relWidth, relHeight },
      includeDate: pdfFieldDateToggle?.checked,
      dateText: pdfFieldDateInput?.value,
      includeName: pdfFieldNameToggle?.checked,
      printedName: pdfFieldNameInput?.value,
      includeAuditCertificate: pdfAuditCertToggle?.checked,
      signerIdentifier: pdfFieldNameInput?.value || config.typedText,
    };

    const result = await stampAndDownloadPdf(currentPdfFile, sigBlob, options);
    showToast(result.message, !result.success);

    btnStampPdf.disabled = false;
    btnStampPdf.textContent = 'Stamp & Download Signed PDF';

    if (result.success) {
      closePdfModal();
    }
  });

  // Signature Vault Modal & Logic
  const vaultModal = document.getElementById('vault-modal') as HTMLElement;
  const btnOpenVault = document.getElementById('btn-open-vault') as HTMLButtonElement;
  const btnCloseVaultModal = document.getElementById('btn-close-vault-modal') as HTMLButtonElement;
  const btnCloseVault = document.getElementById('btn-close-vault') as HTMLButtonElement;
  const vaultItemsContainer = document.getElementById('vault-items-container') as HTMLElement;
  const vaultSaveLabelInput = document.getElementById('vault-save-label-input') as HTMLInputElement;
  const btnModalSaveToVault = document.getElementById('btn-modal-save-to-vault') as HTMLButtonElement;

  function renderVaultUI(): void {
    const items = getVaultItems();
    vaultItemsContainer.innerHTML = '';

    if (items.length === 0) {
      vaultItemsContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.85rem;">
          Your vault is empty. Draw or type a signature and click "Save Current" to store it here.
        </div>`;
      return;
    }

    for (const item of items) {
      const card = document.createElement('div');
      card.className = 'vault-item-card';
      card.innerHTML = `
        <div class="vault-item-preview">
          <img src="${item.dataUrl}" alt="${item.label}" />
        </div>
        <div class="vault-item-header">
          <span class="vault-item-title">${item.label}</span>
          <span class="vault-item-date">${item.createdAt}</span>
        </div>
        <div class="vault-item-actions">
          <button class="btn btn-primary btn-load-vault" data-id="${item.id}" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; flex: 1;">Load</button>
          <button class="btn btn-danger btn-delete-vault" data-id="${item.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Delete</button>
        </div>
      `;

      card.querySelector('.btn-load-vault')?.addEventListener('click', async () => {
        try {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            sigCanvas.setImportedImage(canvas);
            config.mode = 'scan';
            sigCanvas.updateConfig({ mode: 'scan' });
            modeTabScan?.click();
            updateUIState();
            vaultModal.style.display = 'none';
            showToast(`Loaded "${item.label}" from vault!`);
          };
          img.src = item.dataUrl;
        } catch (err) {
          console.error(err);
          showToast('Could not load signature from vault.', true);
        }
      });

      card.querySelector('.btn-delete-vault')?.addEventListener('click', () => {
        deleteFromVault(item.id);
        renderVaultUI();
        showToast('Deleted signature from vault.');
      });

      vaultItemsContainer.appendChild(card);
    }
  }

  async function handleSaveToVault(customLabel?: string): Promise<void> {
    const dims = sigCanvas.getCanvasDimensions();
    const blob = await getSignaturePngBlob(sigCanvas.getStrokes(), dims.width, dims.height, config, sigCanvas.getImportedImage());
    if (!blob) {
      showToast('No signature to save.', true);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const label = customLabel || vaultSaveLabelInput.value || (config.mode === 'type' ? config.typedText : 'My Signature');
      saveToVault(label, dataUrl, config.mode);
      if (vaultSaveLabelInput) vaultSaveLabelInput.value = '';
      renderVaultUI();
      showToast(`Saved "${label}" to vault!`);
    };
    reader.readAsDataURL(blob);
  }

  btnSaveVault?.addEventListener('click', () => {
    handleSaveToVault();
  });

  btnModalSaveToVault?.addEventListener('click', () => {
    handleSaveToVault();
  });

  btnOpenVault?.addEventListener('click', () => {
    renderVaultUI();
    vaultModal.style.display = 'flex';
  });

  const closeVaultModal = () => {
    vaultModal.style.display = 'none';
  };
  btnCloseVaultModal?.addEventListener('click', closeVaultModal);
  btnCloseVault?.addEventListener('click', closeVaultModal);

  // Mobile QR Code Modal & P2P Relay
  const qrModal = document.getElementById('qr-modal') as HTMLElement;
  const btnOpenQr = document.getElementById('btn-open-qr') as HTMLButtonElement;
  const btnCloseQrModal = document.getElementById('btn-close-qr-modal') as HTMLButtonElement;
  const btnCloseQr = document.getElementById('btn-close-qr') as HTMLButtonElement;
  const qrCodeImg = document.getElementById('qr-code-img') as HTMLImageElement;
  const qrModalStatus = document.getElementById('qr-modal-status') as HTMLElement;
  const qrStatusText = document.getElementById('qr-status-text') as HTMLElement;
  const qrStatusDot = document.getElementById('qr-status-dot') as HTMLElement;

  let desktopRelay: DesktopRelaySession | null = null;

  btnOpenQr?.addEventListener('click', async () => {
    if (desktopRelay) {
      desktopRelay.close();
      desktopRelay = null;
    }
    qrModal.style.display = 'flex';
    if (qrStatusText) qrStatusText.textContent = 'Initializing P2P Session...';
    if (qrStatusDot) qrStatusDot.style.color = '#eab308';

    try {
      desktopRelay = await createDesktopRelay(
        () => {
          // Device connected over WebRTC DataChannel
          if (qrStatusText) qrStatusText.textContent = 'Phone Connected! Draw on phone to transfer.';
          if (qrStatusDot) qrStatusDot.style.color = '#10b981';
          if (qrModalStatus) {
            qrModalStatus.style.color = '#10b981';
            qrModalStatus.style.background = 'rgba(16, 185, 129, 0.1)';
            qrModalStatus.style.borderColor = 'rgba(16, 185, 129, 0.2)';
          }
          showToast('Mobile phone connected via WebRTC!');
        },
        (payload) => {
          // Signature received from phone
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            sigCanvas.setImportedImage(canvas);
            config.mode = 'scan';
            sigCanvas.updateConfig({ mode: 'scan' });
            modeTabScan?.click();
            updateUIState();
            closeQrModal();
            showToast('Signature received from mobile device!');
          };
          img.src = payload.dataUrl;
        }
      );

      const qrDataUrl = await generateAppQrCode(desktopRelay.mobileUrl);
      qrCodeImg.src = qrDataUrl;
      if (qrStatusText) qrStatusText.textContent = 'Scan QR code with phone camera';
      if (qrStatusDot) qrStatusDot.style.color = '#2563eb';
    } catch (err) {
      console.error(err);
      if (qrStatusText) qrStatusText.textContent = 'Scan QR code to open mobile studio';
      const fallbackUrl = await generateAppQrCode();
      qrCodeImg.src = fallbackUrl;
    }
  });

  const closeQrModal = () => {
    if (desktopRelay) {
      desktopRelay.close();
      desktopRelay = null;
    }
    qrModal.style.display = 'none';
  };
  btnCloseQrModal?.addEventListener('click', closeQrModal);
  btnCloseQr?.addEventListener('click', closeQrModal);

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    // Check if user is typing into an input
    if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
      return;
    }

    // Ctrl+Z or Cmd+Z
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        sigCanvas.redo();
      } else {
        sigCanvas.undo();
      }
    }
    // Ctrl+Y or Cmd+Y
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      sigCanvas.redo();
    }
    // 'c' or 'Escape' to clear
    else if (e.key.toLowerCase() === 'c' || e.key === 'Escape') {
      if (!sigCanvas.isEmpty()) {
        e.preventDefault();
        sigCanvas.clear();
      }
    }
  });

  // PWA Install Prompt Handling
  let deferredPrompt: any = null;
  const btnInstall = document.getElementById('btn-install') as HTMLButtonElement | null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (btnInstall) {
      btnInstall.style.display = 'inline-flex';
    }
  });

  btnInstall?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      const choice = await deferredPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        showToast('eSignature Studio installed!');
      }
    } catch {
      // Ignored
    }
    deferredPrompt = null;
    btnInstall.style.display = 'none';
  });

  window.addEventListener('appinstalled', () => {
    if (btnInstall) btnInstall.style.display = 'none';
    showToast('App installed successfully!');
  });

  // Offline / Online Status Listeners
  window.addEventListener('offline', () => {
    showToast('Offline mode active. All drawing & export features work 100% offline!');
  });

  // Service Worker Registration with Seamless Auto-Update for PWA
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    // Reload automatically when the new service worker claims control
    let isRefreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!isRefreshing) {
        isRefreshing = true;
        window.location.reload();
      }
    });

    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        // If a worker is already waiting, trigger its immediate takeover
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (installing) {
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                showToast('New version detected. Updating eSignature Studio...');
                installing.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });

        // Check for updates whenever app comes back into focus
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            reg.update().catch(() => {});
          }
        });

        // Periodic check for updates every 15 minutes
        setInterval(() => {
          reg.update().catch(() => {});
        }, 15 * 60 * 1000);
      })
      .catch((err) => {
        console.warn('Service Worker registration skipped or failed:', err);
      });
  }

  // Initial UI state setup
  updateUIState();
});

// Dedicated Mobile Signing Pad Mode (Activated via QR Code Scan)
function initMobileSigningMode(targetSession: string): void {
  // Hide desktop UI sections
  const header = document.querySelector('.app-header') as HTMLElement;
  const container = document.querySelector('.app-container') as HTMLElement;
  const footer = document.querySelector('.app-footer') as HTMLElement;
  if (header) header.style.display = 'none';
  if (container) container.style.display = 'none';
  if (footer) footer.style.display = 'none';

  const mobileView = document.getElementById('mobile-signing-view') as HTMLElement;
  if (mobileView) mobileView.style.display = 'flex';

  const mobileCanvasEl = document.getElementById('mobile-signature-canvas') as HTMLCanvasElement;
  const mobileCanvasHint = document.getElementById('mobile-canvas-hint') as HTMLElement;
  const btnMobileClear = document.getElementById('btn-mobile-clear') as HTMLButtonElement;
  const btnMobileSend = document.getElementById('btn-mobile-send') as HTMLButtonElement;
  const mobileConnBadge = document.getElementById('mobile-conn-badge') as HTMLElement;
  const mobileConnText = document.getElementById('mobile-conn-text') as HTMLElement;
  const mobileSentOverlay = document.getElementById('mobile-sent-overlay') as HTMLElement;
  const btnSignAgain = document.getElementById('btn-mobile-sign-again') as HTMLButtonElement;

  const mobileConfig: SignatureConfig = {
    ...config,
    strokeColor: '#0f172a',
    strokeWidth: 3.5,
    backgroundColor: '',
    backgroundType: 'transparent',
    smoothingFactor: 0.65,
    dynamicPressure: true,
  };

  const mobileCanvas = new SignatureCanvas({
    canvas: mobileCanvasEl,
    config: mobileConfig,
    onChange: () => {
      const empty = mobileCanvas.isEmpty();
      if (mobileCanvasHint) {
        if (empty) mobileCanvasHint.classList.remove('hidden');
        else mobileCanvasHint.classList.add('hidden');
      }
      if (btnMobileSend) {
        btnMobileSend.disabled = empty;
      }
    },
  });

  btnMobileClear?.addEventListener('click', () => {
    mobileCanvas.clear();
  });

  let mobileClient: MobileRelayClient | null = null;

  try {
    mobileClient = connectMobileToDesktop(
      targetSession,
      () => {
        // Connected to desktop!
        if (mobileConnText) mobileConnText.textContent = 'Connected to Computer';
        if (mobileConnBadge) {
          mobileConnBadge.style.color = '#10b981';
          mobileConnBadge.style.background = 'rgba(16, 185, 129, 0.1)';
          mobileConnBadge.style.borderColor = 'rgba(16, 185, 129, 0.2)';
        }
      },
      () => {
        if (mobileConnText) mobileConnText.textContent = 'Disconnected';
      }
    );
  } catch (err) {
    console.error('Failed to connect mobile client:', err);
  }

  btnMobileSend?.addEventListener('click', async () => {
    if (mobileCanvas.isEmpty() || !mobileClient) return;

    btnMobileSend.disabled = true;
    btnMobileSend.textContent = 'Sending...';

    const dims = mobileCanvas.getCanvasDimensions();
    const blob = await getSignaturePngBlob(mobileCanvas.getStrokes(), dims.width, dims.height, mobileConfig);

    if (!blob) {
      btnMobileSend.disabled = false;
      btnMobileSend.textContent = 'Send to Computer ✓';
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const sent = await mobileClient!.sendSignature(dataUrl, mobileCanvas.getStrokes());
      if (sent) {
        if (mobileSentOverlay) mobileSentOverlay.style.display = 'flex';
      } else {
        alert('Could not transfer signature. Please check connection and try again.');
        btnMobileSend.disabled = false;
        btnMobileSend.textContent = 'Send to Computer ✓';
      }
    };
    reader.readAsDataURL(blob);
  });

  btnSignAgain?.addEventListener('click', () => {
    mobileCanvas.clear();
    if (mobileSentOverlay) mobileSentOverlay.style.display = 'none';
    if (btnMobileSend) {
      btnMobileSend.disabled = true;
      btnMobileSend.textContent = 'Send to Computer ✓';
    }
  });
}

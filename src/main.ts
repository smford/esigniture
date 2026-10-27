import './style.css';
import { SignatureConfig, BackgroundType, ExportFormat } from './types';
import { SignatureCanvas } from './engine/signatureCanvas';
import { exportSignature, copySignatureToClipboard, generateSvg } from './engine/exporter';
import { computeBoundingBox } from './engine/smoothing';
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

  const canvasEl = document.getElementById('signature-canvas') as HTMLCanvasElement;
  const canvasContainer = document.getElementById('canvas-container') as HTMLElement;
  const canvasHint = document.getElementById('canvas-hint') as HTMLElement;

  const btnUndo = document.getElementById('btn-undo') as HTMLButtonElement;
  const btnRedo = document.getElementById('btn-redo') as HTMLButtonElement;
  const btnClear = document.getElementById('btn-clear') as HTMLButtonElement;

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
    if (config.mode === 'type') {
      const hasText = config.typedText.trim().length > 0;
      btnUndo.disabled = true;
      btnRedo.disabled = true;
      btnClear.disabled = !hasText;
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
  const drawControls = document.getElementById('draw-controls') as HTMLElement;
  const typeControls = document.getElementById('type-controls') as HTMLElement;

  modeTabDraw?.addEventListener('click', () => {
    modeTabDraw.classList.add('active');
    modeTabType.classList.remove('active');
    drawControls.style.display = 'flex';
    typeControls.style.display = 'none';
    config.mode = 'draw';
    sigCanvas.updateConfig({ mode: 'draw' });
    updateUIState();
  });

  modeTabType?.addEventListener('click', () => {
    modeTabType.classList.add('active');
    modeTabDraw.classList.remove('active');
    drawControls.style.display = 'none';
    typeControls.style.display = 'flex';
    config.mode = 'type';
    sigCanvas.updateConfig({ mode: 'type' });
    updateUIState();
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
      format
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
      config
    );
    showToast(result.message, !result.success);
  });

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

  // Service Worker Registration for PWA & Offline Support
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        reg.onupdatefound = () => {
          const installing = reg.installing;
          if (installing) {
            installing.onstatechange = () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                showToast('Updated version ready. Refresh to update!');
              }
            };
          }
        };
      })
      .catch((err) => {
        console.warn('Service Worker registration skipped or failed:', err);
      });
  }

  // Initial UI state setup
  updateUIState();
});

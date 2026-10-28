# eSignature Studio

> A fast, elegant, and 100% private digital signature studio that runs entirely in your browser. Draw smooth signatures with your mouse or trackpad, type cursive signatures, clean paper photo scans, and stamp PDF contracts visually—with zero server uploads.

🌐 **Live Web App:** [http://stephenford.org/esigniture/](http://stephenford.org/esigniture/) *(or [https://smford.github.io/esigniture/](https://smford.github.io/esigniture/))*  
📜 **License:** [GNU AGPL-3.0](LICENSE) &bull; **Copyright &copy; 2026 smford**

---

## 🎯 The Problems This Tool Solves

Signing documents digitally today is surprisingly frustrating and fraught with privacy risks:

1. **Ugly, Jagged Lines from Mice and Trackpads**: Drawing a signature with a mouse or trackpad normally produces robotic, stepped, jagged lines due to low sensor polling rates and hand tremors.
2. **Cloud Privacy & Security Risks**: Most commercial e-signature platforms require you to upload confidential legal agreements, NDAs, financial contracts, and tax documents to their corporate cloud servers. You lose custody of your sensitive files and biometric signature data.
3. **Expensive Subscriptions & Paywalls**: Many tools limit how many documents you can sign per month or charge hefty recurring subscription fees just to place an image on a PDF.
4. **Clunky Mobile-to-Desktop Transitions**: When you need to sign a PDF on your laptop, drawing with a mouse is awkward, but transferring documents back and forth to your phone or tablet is tedious.

---

## 🔒 Why eSignature Studio Is Truly Secure

* **100% Local & Client-Side Execution**: Every mathematical curve calculation, pixel thresholding pass, PDF rendering, and document modification happens **exclusively inside your local browser memory**.
* **Zero Server Transmission**: No files, signatures, IP logs, or biometrics are ever sent to external servers or cloud databases. There is no backend server.
* **Works Completely Offline & Auto-Updates (PWA)**: Equipped with a Cache-First Service Worker. Installed PWAs auto-detect new versions on focus, trigger immediate background updates via `skipWaiting()`, and reload seamlessly without manual intervention.
* **Cryptographic Tamper-Proof Audit Trail**: Calculates SHA-256 cryptographic hashes of your original documents and appends an optional verifiable **Certificate of Completion** to the signed PDF.
* **Strict Content Security Policy (CSP)**: Built with browser-level security policies that prevent external script injection and unauthorized network requests.
* **Free & Open Source (AGPL-3.0)**: Fully auditable, open source code under the copyleft GNU Affero General Public License.

---

## ✨ Key Features That Make This Tool the Best Choice

### 1. 🖊️ Intelligent Trackpad & Mouse Curve Smoothing
* **Sub-Frame Coalesced Pointer Events**: Captures high-frequency micro-movements between animation frames.
* **Multi-Stage Smoothing Pipeline**: Filters out sensor jitter and applies continuous Exponential Moving Average (EMA) smoothing.
* **Midpoint Quadratic Bézier Splines**: Guarantees organic, continuous $C^1$ curves without sharp angles.
* **Dynamic Velocity Pen Physics**: Mimics a real fountain pen—fast strokes taper gracefully, while deliberate strokes produce rich, full ink. Supports hardware stylus pressure (Apple Pencil, Surface Pen).

### 2. 📄 Visual Drag-and-Drop PDF Signer
* Drop any PDF contract, agreement, or form into the studio.
* Previews document pages directly in your browser.
* **Click, drag, and resize** your signature overlay to the exact signature line on any page.
* Add complementary fields in one click:
  * **Automatic Date Stamp** (`YYYY-MM-DD` or customized)
  * **Printed Full Name / Title** (e.g., `Jane Doe, Director`)
  * **Cryptographic SHA-256 Audit Seal**
* Download the stamped PDF instantly—**100% client-side**.

### 3. ✍️ Type-to-Sign (Cursive Calligraphy)
* Don't have a pen or mouse handy? Type your name or initials and choose from curated calligraphic handwriting fonts (*Caveat*, *Dancing Script*, *Great Vibes*, *Sacramento*).
* Live font sizing and color matching.

### 4. 📷 Physical Signature Scanner & Background Cleaner
* Snap a photo of your handwritten signature on paper with your phone and upload it.
* Client-side adaptive luminance thresholding automatically strips the off-white paper and camera shadows, leaving only clean, transparent ink.
* Adjustable threshold and contrast sliders with live preview, with optional ink recoloring to match chosen digital palettes.

### 5. 🔐 Encrypted Local Signature Vault
* Save multiple signature profiles (e.g., "Full Legal Signature", "My Initials", "Stamp") into your browser's private local vault.
* One-click recall and loading whenever you return to the app.

### 6. 📱 Cross-Device Mobile Relay (Sign on Phone)
* Working on a desktop or laptop? Click **"Sign on Mobile"** to display a QR code.
* Scan the code with your smartphone or iPad camera to draw comfortably using your finger or stylus—no app installation needed.

### 7. 💾 Multiple High-Resolution Export Formats
* **SVG**: Infinite scalable vector graphics for crisp printing at any resolution.
* **PNG**: 2x supersampled high-DPI raster images with transparent, pure white, warm parchment, or dark slate backgrounds.
* **JPEG & WebP**: High-quality compressed formats.
* **One-Click Clipboard Copy**: Instantly copy your signature directly to your system clipboard to paste into Google Docs, Apple Mail, Word, or Slack.
* **Auto-Trim Whitespace**: Automatically crops exported files to the signature bounds with balanced padding.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>⌘Z</kbd> / <kbd>Ctrl+Z</kbd> | Undo last stroke |
| <kbd>⇧⌘Z</kbd> / <kbd>Ctrl+Y</kbd> | Redo stroke |
| <kbd>Esc</kbd> or <kbd>C</kbd> | Clear canvas / reset input |

---

## 🛠️ Development & Testing

```bash
# Clone repository
git clone https://github.com/smford/esigniture.git
cd esigniture

# Install dependencies
npm install

# Run automated test suite
npm test

# Launch local dev server
npm run dev

# Build production bundle
npm run build
```

---

## ⚖️ License & Copyright

Copyright &copy; 2026 **smford**.

This program is free software: you can redistribute it and/or modify it under the terms of the **GNU Affero General Public License (AGPL-3.0)** as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

See the [LICENSE](LICENSE) file for details.

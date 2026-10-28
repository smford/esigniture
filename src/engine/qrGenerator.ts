import QRCode from 'qrcode';

export async function generateAppQrCode(url?: string): Promise<string> {
  const targetUrl = url || window.location.href;
  return QRCode.toDataURL(targetUrl, {
    width: 240,
    margin: 2,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}

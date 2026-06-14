export async function generateQrDataUrl(text: string, size = 120): Promise<string | null> {
  try {
    const QRCode = await import('qrcode');
    return await QRCode.default.toDataURL(text, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
  } catch {
    return null;
  }
}

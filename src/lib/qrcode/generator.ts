import QRCode from 'qrcode';

/**
 * Generates a base64 Data URL for a given verification URL or payload
 */
export async function generateQrCodeDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 280,
      margin: 2,
      color: {
        dark: '#006a4e', // Bangladesh Gov Green
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Failed to generate QR code', err);
    throw new Error('QR code generation failed');
  }
}

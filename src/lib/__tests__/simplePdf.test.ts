import { describe, expect, it } from 'vitest';
import { createSimplePdf } from '../simplePdf';

const makeJpegDataUrl = (width: number, height: number): string => {
  const bytes = new Uint8Array([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x0b, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x01, 0x01, 0x11, 0x00,
    0xff, 0xda,
    0xff, 0xd9,
  ]);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return `data:image/jpeg;base64,${btoa(binary)}`;
};

const readBlob = (blob: Blob): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read PDF blob'));
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(blob);
  });

describe('SimplePdfDocument', () => {
  it('stores embedded JPEG pixel dimensions separately from display size', async () => {
    const doc = createSimplePdf();

    doc.addImage(makeJpegDataUrl(3, 2), 'JPEG', 15, 20, 50, 40);

    const pdf = new TextDecoder().decode(await readBlob(doc.toBlob()));
    expect(pdf).toContain('/Subtype /Image /Width 3 /Height 2');
    expect(pdf).toContain('141.73 0 0 113.39');
  });

  it('rejects non-JPEG image data explicitly', () => {
    const doc = createSimplePdf();

    expect(() => {
      doc.addImage('data:image/png;base64,AAAA', 'PNG', 0, 0, 10, 10);
    }).toThrow(/Only JPEG/);
  });
});

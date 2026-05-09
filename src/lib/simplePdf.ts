type PdfColor = [number, number, number];

interface PdfPage {
  ops: string[];
}

interface PdfImage {
  name: string;
  bytes: Uint8Array;
  pixelWidth: number;
  pixelHeight: number;
}

interface TextOptions {
  align?: "left" | "center" | "right";
}

const MM_TO_PT = 72 / 25.4;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

const clampByte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

const mmToPt = (value: number): string => (value * MM_TO_PT).toFixed(2);

const colorToPdf = (color: PdfColor): string =>
  color.map((value) => (clampByte(value) / 255).toFixed(3)).join(" ");

const utf16Hex = (text: string): string => {
  let hex = "FEFF";
  for (let index = 0; index < text.length; index += 1) {
    hex += text.charCodeAt(index).toString(16).padStart(4, "0").toUpperCase();
  }
  return `<${hex}>`;
};

const encode = (value: string): Uint8Array => new TextEncoder().encode(value);

const concatBytes = (parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
};

const dataUrlToJpeg = (dataUrl: string): Uint8Array => {
  const match = /^data:image\/jpe?g;base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) {
    throw new Error("Only JPEG data URLs can be embedded in lightweight PDF exports.");
  }

  const binary = atob(match[1]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const readJpegDimensions = (bytes: Uint8Array): { width: number; height: number } => {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error("Invalid JPEG data URL.");
  }

  let offset = 2;
  while (offset < bytes.length) {
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 2 > bytes.length) break;

    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame) {
      if (segmentLength < 7) break;
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      if (width > 0 && height > 0) return { width, height };
      break;
    }

    offset += segmentLength;
  }

  throw new Error("Could not read JPEG dimensions for PDF export.");
};

const downloadPdfBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export class SimplePdfDocument {
  readonly internal = {
    pageSize: {
      getWidth: () => this.pageWidth,
      getHeight: () => this.pageHeight,
    },
  };

  private readonly pageWidth = A4_WIDTH_MM;
  private readonly pageHeight = A4_HEIGHT_MM;
  private pages: PdfPage[] = [{ ops: [] }];
  private images: PdfImage[] = [];
  private activePageIndex = 0;
  private fontSize = 12;
  private fontStyle: "normal" | "bold" = "normal";
  private textColor: PdfColor = [0, 0, 0];
  private fillColor: PdfColor = [0, 0, 0];

  addPage(): void {
    this.pages.push({ ops: [] });
    this.activePageIndex = this.pages.length - 1;
  }

  setPage(pageNumber: number): void {
    const index = pageNumber - 1;
    if (index >= 0 && index < this.pages.length) {
      this.activePageIndex = index;
    }
  }

  getNumberOfPages(): number {
    return this.pages.length;
  }

  setFontSize(size: number): void {
    this.fontSize = size;
  }

  setFont(_family: string, style: "normal" | "bold" = "normal"): void {
    this.fontStyle = style === "bold" ? "bold" : "normal";
  }

  setTextColor(red: number, green: number, blue: number): void {
    this.textColor = [red, green, blue];
  }

  setFillColor(red: number, green: number, blue: number): void {
    this.fillColor = [red, green, blue];
  }

  rect(x: number, y: number, width: number, height: number, style?: string): void {
    if (style !== "F") return;

    const yBottom = this.pageHeight - y - height;
    this.currentPage.ops.push(
      `${colorToPdf(this.fillColor)} rg ${mmToPt(x)} ${mmToPt(yBottom)} ${mmToPt(width)} ${mmToPt(
        height
      )} re f`
    );
  }

  text(input: string | string[], x: number, y: number, options: TextOptions = {}): void {
    const lines = Array.isArray(input) ? input : [input];
    const lineHeight = this.fontSize * 0.3528 * 1.16;

    lines.forEach((line, index) => {
      const lineY = y + index * lineHeight;
      const estimatedWidth = this.estimateTextWidthMm(line);
      const adjustedX =
        options.align === "center"
          ? x - estimatedWidth / 2
          : options.align === "right"
            ? x - estimatedWidth
            : x;

      const font = this.fontStyle === "bold" ? "F2" : "F1";
      const yPdf = this.pageHeight - lineY;
      this.currentPage.ops.push(
        `BT ${colorToPdf(this.textColor)} rg /${font} ${this.fontSize.toFixed(2)} Tf 1 0 0 1 ${mmToPt(
          adjustedX
        )} ${mmToPt(yPdf)} Tm ${utf16Hex(line)} Tj ET`
      );
    });
  }

  splitTextToSize(text: string, maxWidthMm: number): string[] {
    const maxWidthPt = maxWidthMm * MM_TO_PT;
    const maxChars = Math.max(8, Math.floor(maxWidthPt / (this.fontSize * 0.52)));
    const output: string[] = [];

    for (const paragraph of text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")) {
      const words = paragraph.split(/\s+/).filter(Boolean);
      let line = "";

      for (const word of words) {
        if (word.length > maxChars) {
          if (line) {
            output.push(line);
            line = "";
          }
          for (let index = 0; index < word.length; index += maxChars) {
            output.push(word.slice(index, index + maxChars));
          }
          continue;
        }

        const candidate = line ? `${line} ${word}` : word;
        if (candidate.length > maxChars && line) {
          output.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }

      if (line) output.push(line);
      else output.push("");
    }

    return output;
  }

  addImage(dataUrl: string, _format: string, x: number, y: number, width: number, height: number): void {
    const bytes = dataUrlToJpeg(dataUrl);
    const dimensions = readJpegDimensions(bytes);
    const name = `Im${this.images.length + 1}`;
    this.images.push({
      name,
      bytes,
      pixelWidth: dimensions.width,
      pixelHeight: dimensions.height,
    });

    const yBottom = this.pageHeight - y - height;
    this.currentPage.ops.push(
      `q ${mmToPt(width)} 0 0 ${mmToPt(height)} ${mmToPt(x)} ${mmToPt(yBottom)} cm /${name} Do Q`
    );
  }

  save(filename: string): void {
    downloadPdfBlob(this.toBlob(), filename);
  }

  toBlob(): Blob {
    const bytes = this.toBytes();
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return new Blob([buffer], { type: "application/pdf" });
  }

  private get currentPage(): PdfPage {
    return this.pages[this.activePageIndex];
  }

  private estimateTextWidthMm(text: string): number {
    return text.length * this.fontSize * 0.3528 * (this.fontStyle === "bold" ? 0.54 : 0.5);
  }

  private toBytes(): Uint8Array {
    const objects: Uint8Array[][] = [];
    const addObject = (parts: Array<string | Uint8Array>): number => {
      objects.push(parts.map((part) => (typeof part === "string" ? encode(part) : part)));
      return objects.length;
    };
    const setObject = (id: number, parts: Array<string | Uint8Array>): void => {
      objects[id - 1] = parts.map((part) => (typeof part === "string" ? encode(part) : part));
    };

    const catalogId = addObject([]);
    const pagesId = addObject([]);
    const regularFontId = addObject(["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]);
    const boldFontId = addObject(["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"]);

    const imageIds = this.images.map((image) =>
      addObject([
        `<< /Type /XObject /Subtype /Image /Width ${image.pixelWidth} /Height ${image.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.byteLength} >>\nstream\n`,
        image.bytes,
        "\nendstream",
      ])
    );

    const xObjectResources =
      this.images.length > 0
        ? `/XObject << ${this.images.map((image, index) => `/${image.name} ${imageIds[index]} 0 R`).join(" ")} >>`
        : "";

    const pageIds: number[] = [];
    for (const page of this.pages) {
      const content = page.ops.join("\n");
      const contentBytes = encode(content);
      const contentId = addObject([
        `<< /Length ${contentBytes.byteLength} >>\nstream\n`,
        contentBytes,
        "\nendstream",
      ]);
      const pageId = addObject([
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${mmToPt(
          this.pageWidth
        )} ${mmToPt(this.pageHeight)}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> ${xObjectResources} >> /Contents ${contentId} 0 R >>`,
      ]);
      pageIds.push(pageId);
    }

    setObject(pagesId, [
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`,
    ]);
    setObject(catalogId, [`<< /Type /Catalog /Pages ${pagesId} 0 R >>`]);

    const chunks: Uint8Array[] = [encode("%PDF-1.4\n")];
    const offsets = [0];
    let cursor = chunks[0].byteLength;

    objects.forEach((parts, index) => {
      offsets[index + 1] = cursor;
      const objectBytes = concatBytes([encode(`${index + 1} 0 obj\n`), ...parts, encode("\nendobj\n")]);
      chunks.push(objectBytes);
      cursor += objectBytes.byteLength;
    });

    const xrefOffset = cursor;
    const xrefRows = offsets
      .map((offset, index) =>
        index === 0 ? "0000000000 65535 f " : `${String(offset).padStart(10, "0")} 00000 n `
      )
      .join("\n");
    const trailer = `xref\n0 ${objects.length + 1}\n${xrefRows}\ntrailer\n<< /Size ${
      objects.length + 1
    } /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    chunks.push(encode(trailer));

    return concatBytes(chunks);
  }
}

export const createSimplePdf = (): SimplePdfDocument => new SimplePdfDocument();

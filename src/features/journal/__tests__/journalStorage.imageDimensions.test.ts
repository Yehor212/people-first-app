import { describe, expect, it } from "vitest";

import { readRasterDimensions } from "../journalStorage";

function vp8xHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30);
  bytes.set(new TextEncoder().encode("RIFF"), 0);
  bytes.set(new TextEncoder().encode("WEBP"), 8);
  bytes.set(new TextEncoder().encode("VP8X"), 12);
  const storedWidth = width - 1;
  const storedHeight = height - 1;
  bytes[24] = storedWidth & 0xff;
  bytes[25] = (storedWidth >> 8) & 0xff;
  bytes[26] = (storedWidth >> 16) & 0xff;
  bytes[27] = storedHeight & 0xff;
  bytes[28] = (storedHeight >> 8) & 0xff;
  bytes[29] = (storedHeight >> 16) & 0xff;
  return bytes;
}

describe("journal image header bounds", () => {
  it("reads WebP canvas dimensions before bitmap decoding", () => {
    expect(readRasterDimensions(vp8xHeader(1200, 800))).toEqual({
      width: 1200,
      height: 800,
    });
  });
});

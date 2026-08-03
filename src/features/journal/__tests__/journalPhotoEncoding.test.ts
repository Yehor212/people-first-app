import { describe, expect, it, vi } from "vitest";

import {
  encodeJournalPhotoWithinLimit,
  getDataUrlDecodedByteLength,
} from "../journalPhotoEncoding";

const jpegDataUrl = (decodedBytes: number) => {
  const base64Length = Math.ceil(decodedBytes / 3) * 4;
  return `data:image/jpeg;base64,${"A".repeat(base64Length)}`;
};

describe("journal photo adaptive encoding", () => {
  it("counts decoded base64 bytes without charging for the data URL header", () => {
    expect(getDataUrlDecodedByteLength("data:image/jpeg;base64,QUJDRA==")).toBe(4);
  });

  it("keeps the first high-quality full-size result when it fits", async () => {
    const encode = vi.fn(async (maxDimension: number, quality: number) => ({
      dataUrl: jpegDataUrl(900_000),
      width: maxDimension,
      height: Math.round(maxDimension * 0.75),
      quality,
    }));

    const result = await encodeJournalPhotoWithinLimit(encode, 1_048_576);

    expect(result.width).toBe(2560);
    expect(result.quality).toBe(0.9);
    expect(encode).toHaveBeenCalledTimes(1);
  });

  it("tries lower quality at full resolution before reducing dimensions", async () => {
    const encode = vi.fn(async (maxDimension: number, quality: number) => ({
      dataUrl: jpegDataUrl(quality <= 0.82 ? 980_000 : 1_200_000),
      width: maxDimension,
      height: Math.round(maxDimension * 0.75),
      quality,
    }));

    const result = await encodeJournalPhotoWithinLimit(encode, 1_048_576);

    expect(result).toMatchObject({ width: 2560, quality: 0.82 });
    expect(encode.mock.calls.map(([dimension, quality]) => [dimension, quality])).toEqual([
      [2560, 0.9],
      [2560, 0.86],
      [2560, 0.82],
    ]);
  });

  it("reduces dimensions only when every reviewed quality at the larger size is too large", async () => {
    const encode = vi.fn(async (maxDimension: number, quality: number) => ({
      dataUrl: jpegDataUrl(maxDimension < 2560 ? 900_000 : 1_200_000),
      width: maxDimension,
      height: Math.round(maxDimension * 0.75),
      quality,
    }));

    const result = await encodeJournalPhotoWithinLimit(encode, 1_048_576);

    expect(result.width).toBeLessThan(2560);
    expect(result.quality).toBe(0.9);
    expect(encode).toHaveBeenCalledWith(2560, 0.74);
  });

  it("fails without storing an image when every bounded attempt exceeds the limit", async () => {
    const encode = vi.fn(async (maxDimension: number, quality: number) => ({
      dataUrl: jpegDataUrl(1_200_000),
      width: maxDimension,
      height: Math.round(maxDimension * 0.75),
      quality,
    }));

    await expect(encodeJournalPhotoWithinLimit(encode, 1_048_576)).rejects.toThrow(
      "Photo could not be prepared within the storage limit",
    );
  });
});

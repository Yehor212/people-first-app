import { describe, expect, it, vi } from "vitest";

import { readCompressedHabitTgsAsset } from "../habitTgsRuntime";

describe("habit TGS runtime asset loading", () => {
  it("decodes Vite-inlined base64 TGS without a CSP-blocked fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const expected = Uint8Array.from([31, 139, 8, 0, 90, 101, 110]);
    const encoded = btoa(String.fromCharCode(...expected));

    await expect(
      readCompressedHabitTgsAsset(`data:application/octet-stream;base64,${encoded}`),
    ).resolves.toEqual(expected);
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});

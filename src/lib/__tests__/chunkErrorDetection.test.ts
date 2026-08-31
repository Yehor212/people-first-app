import { describe, expect, it } from "vitest";
import {
  chunkFromFilename,
  chunkFromMessage,
  getErrorMessage,
  isChunkLoadError,
  isChunkLoadMessage,
} from "../chunkErrorDetection";

describe("chunkErrorDetection", () => {
  describe("isChunkLoadError", () => {
    it("detects Chrome-style dynamic import failure", () => {
      const err = new Error(
        "Failed to fetch dynamically imported module: https://app.example/assets/Page-abc.js",
      );
      expect(isChunkLoadError(err)).toBe(true);
    });

    it("detects webpack-style ChunkLoadError", () => {
      expect(isChunkLoadError(new Error("ChunkLoadError: Loading chunk 5 failed"))).toBe(true);
    });

    it("detects Vite 'Loading chunk' phrase", () => {
      expect(isChunkLoadError(new Error("Loading chunk main failed"))).toBe(true);
    });

    it("detects Vite 'Loading CSS chunk' phrase", () => {
      expect(isChunkLoadError(new Error("Loading CSS chunk 3 failed"))).toBe(true);
    });

    it("detects Safari / Firefox module script failure", () => {
      expect(isChunkLoadError(new Error("Importing a module script failed"))).toBe(true);
    });

    it("returns false for unrelated errors", () => {
      expect(isChunkLoadError(new Error("TypeError: x is undefined"))).toBe(false);
      expect(isChunkLoadError(new Error("NetworkError"))).toBe(false);
    });

    it("returns false for null / undefined / empty", () => {
      expect(isChunkLoadError(null)).toBe(false);
      expect(isChunkLoadError(undefined)).toBe(false);
      expect(isChunkLoadError(new Error(""))).toBe(false);
    });

    it("is total for hostile message getters and proxies", () => {
      const canary = "ZF_T172_CHUNK_HOSTILE_7a2c91e4";
      const getter = Object.create(Error.prototype);
      Object.defineProperty(getter, "message", { get: () => { throw new Error(canary); } });
      const proxy = new Proxy({}, {
        has: () => { throw new Error(canary); },
        getPrototypeOf: () => { throw new Error(canary); },
      });

      expect(() => getErrorMessage(getter)).not.toThrow();
      expect(() => isChunkLoadError(proxy)).not.toThrow();
      expect(getErrorMessage(getter)).toBeNull();
      expect(isChunkLoadError(proxy)).toBe(false);
    });
  });

  describe("isChunkLoadMessage", () => {
    it("matches on raw strings (window.onerror first arg)", () => {
      expect(isChunkLoadMessage("Failed to fetch dynamically imported module")).toBe(true);
      expect(isChunkLoadMessage("Loading chunk 7 failed")).toBe(true);
    });

    it("returns false for null / undefined / empty string", () => {
      expect(isChunkLoadMessage(null)).toBe(false);
      expect(isChunkLoadMessage(undefined)).toBe(false);
      expect(isChunkLoadMessage("")).toBe(false);
    });

    it("returns false for unrelated strings", () => {
      expect(isChunkLoadMessage("Uncaught TypeError")).toBe(false);
    });
  });

  describe("chunkFromFilename", () => {
    it("extracts the filename from a JS path", () => {
      expect(chunkFromFilename("/assets/Page-abc123.js")).toBe("Page-abc123.js");
      expect(chunkFromFilename("https://cdn.example/js/chunk-5.js")).toBe("chunk-5.js");
    });

    it("returns 'unknown' when no .js filename matches", () => {
      expect(chunkFromFilename("")).toBe("unknown");
      expect(chunkFromFilename(null)).toBe("unknown");
      expect(chunkFromFilename(undefined)).toBe("unknown");
      expect(chunkFromFilename("just-text")).toBe("unknown");
      expect(chunkFromFilename("/path/to/somewhere")).toBe("unknown");
    });
  });

  describe("chunkFromMessage", () => {
    it("extracts the chunk filename from an embedded URL", () => {
      const msg =
        "Failed to fetch dynamically imported module: https://app.example/assets/Lazy-xyz.js";
      expect(chunkFromMessage(msg)).toBe("Lazy-xyz.js");
    });

    it("returns 'unknown' when no URL is present", () => {
      expect(chunkFromMessage("Loading chunk failed")).toBe("unknown");
    });

    it("returns 'unknown' for null / undefined / empty", () => {
      expect(chunkFromMessage(null)).toBe("unknown");
      expect(chunkFromMessage(undefined)).toBe("unknown");
      expect(chunkFromMessage("")).toBe("unknown");
    });

    it("handles URL without .js extension gracefully", () => {
      expect(chunkFromMessage("Failed: https://app.example/some/path")).toBe("unknown");
    });
  });
});

import { describe, expect, it } from "vitest";
import { en } from "../languages/en";
import {
  LANGUAGE_RUNTIME_CACHE_MAX_ENTRIES,
  isLanguageRuntimeAssetRequest,
  resolveTranslationPayload,
} from "../localeAssetRuntime";

describe("language runtime asset caching", () => {
  it.each([
    ["/people-first-app/assets/uk-Ab_12.js", "script"],
    ["/people-first-app/assets/he-z9_-.js", "script"],
    ["/people-first-app/assets/locale-uk-Ab_12.json", ""],
    ["/people-first-app/assets/locale-ar-z9_-.json", ""],
  ] as const)("matches the versioned language asset %s", (pathname, destination) => {
    expect(isLanguageRuntimeAssetRequest(pathname, destination)).toBe(true);
  });

  it.each([
    ["/people-first-app/assets/en-Ab_12.js", "script"],
    ["/people-first-app/assets/locale-en-Ab_12.json", ""],
    ["/people-first-app/assets/locale-uk-Ab_12.json", "script"],
    ["/people-first-app/assets/private-user-history.json", ""],
    ["https://other.example/assets/locale-uk-Ab_12.json", ""],
  ] as const)("rejects a non-runtime-language request %s", (pathname, destination) => {
    expect(isLanguageRuntimeAssetRequest(pathname, destination)).toBe(false);
  });

  it("keeps the current and previous hashed loader-plus-payload set", () => {
    expect(LANGUAGE_RUNTIME_CACHE_MAX_ENTRIES).toBeGreaterThanOrEqual(28);
  });

  it("unwraps a generated locale promise only when its shape matches English", async () => {
    await expect(resolveTranslationPayload(Promise.resolve(en), en, "uk")).resolves.toBe(en);

    const missingKey = { ...en } as Record<string, unknown>;
    delete missingKey.appName;
    await expect(resolveTranslationPayload(missingKey, en, "uk")).rejects.toThrow(
      /invalid shape: uk/,
    );

    await expect(resolveTranslationPayload(undefined, en, "uk")).rejects.toThrow(
      /empty: uk/,
    );
  });
});

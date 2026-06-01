import { describe, expect, it } from "vitest";

import { isTrustedDesktopReleaseUrl, resolveDesktopRelease } from "../desktopRelease";

describe("desktopRelease", () => {
  const validUrl =
    "https://github.com/Yehor212/people-first-app/releases/download/desktop-v2.0.0/ZenFlow_2.0.0_x64-setup.exe";
  const validHash = "A".repeat(64);

  it("keeps the public download locked when release proof is missing", () => {
    expect(resolveDesktopRelease({}).ready).toBe(false);
    expect(
      resolveDesktopRelease({
        VITE_DESKTOP_SIGNED_RELEASE_URL: validUrl,
        VITE_DESKTOP_SIGNED_RELEASE_SHA256: validHash,
      }).ready,
    ).toBe(false);
  });

  it("accepts only the signed ZenFlow setup asset from the project GitHub releases", () => {
    expect(isTrustedDesktopReleaseUrl(validUrl)).toBe(true);
    expect(
      isTrustedDesktopReleaseUrl(
        "https://github.com/Yehor212/people-first-app/releases/download/desktop-v2.0.0/zenflow-desktop.exe",
      ),
    ).toBe(false);
    expect(
      isTrustedDesktopReleaseUrl(
        "https://example.com/Yehor212/people-first-app/releases/download/v1/ZenFlow_2.0.0_x64-setup.exe",
      ),
    ).toBe(false);
  });

  it("opens the public download only when URL, hash, and Authenticode status are all valid", () => {
    const release = resolveDesktopRelease({
      VITE_DESKTOP_SIGNED_RELEASE_URL: validUrl,
      VITE_DESKTOP_SIGNED_RELEASE_SHA256: validHash,
      VITE_DESKTOP_SIGNED_RELEASE_AUTHENTICODE: "Valid",
    });

    expect(release.ready).toBe(true);
    expect(release.downloadUrl).toBe(validUrl);
    expect(release.sha256).toBe(validHash);
    expect(release.signatureStatus).toBe("Valid");
  });
});

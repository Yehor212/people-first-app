import { beforeEach, describe, expect, it, vi } from "vitest";

const SPA_REDIRECT_STORAGE_KEY = "zenflow:spa-redirect";

const importSpaRedirect = async () => {
  vi.resetModules();
  await import("../spaRedirect");
};

describe("spaRedirect", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState(null, "", "/people-first-app/");
  });

  it("restores a GitHub Pages 404 route stored by public/404.html", async () => {
    sessionStorage.setItem(SPA_REDIRECT_STORAGE_KEY, "/orb?nav=v2#today");

    await importSpaRedirect();

    expect(window.location.pathname).toBe("/people-first-app/orb");
    expect(window.location.search).toBe("?nav=v2");
    expect(window.location.hash).toBe("#today");
    expect(sessionStorage.getItem(SPA_REDIRECT_STORAGE_KEY)).toBeNull();
  });

  it("rejects stored redirects that resolve outside the current origin", async () => {
    sessionStorage.setItem(SPA_REDIRECT_STORAGE_KEY, "//evil.example/path");

    await importSpaRedirect();

    expect(window.location.pathname).toBe("/people-first-app/");
    expect(window.location.search).toBe("");
    expect(sessionStorage.getItem(SPA_REDIRECT_STORAGE_KEY)).toBeNull();
  });

  it("keeps support for legacy /?/ redirect URLs", async () => {
    window.history.replaceState(null, "", "/people-first-app/?/diary&view=week#entry");

    await importSpaRedirect();

    expect(window.location.pathname).toBe("/people-first-app/diary");
    expect(window.location.search).toBe("?view=week");
    expect(window.location.hash).toBe("#entry");
  });
});

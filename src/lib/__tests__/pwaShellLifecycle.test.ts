import { describe, expect, it } from "vitest";

describe("pwa shell lifecycle primitives", () => {
  it("exposes the approved runtime boundary before the shell listens for browser lifecycle events", async () => {
    const lifecycleModules = import.meta.glob("../pwaShellLifecycle.ts", { eager: true });
    const lifecycle = lifecycleModules["../pwaShellLifecycle.ts"] as
      | Record<string, unknown>
      | undefined;

    expect(lifecycle).toBeDefined();
    expect(typeof lifecycle?.resolveAppRuntimeSurface).toBe("function");
    expect(typeof lifecycle?.canUsePwaShellLifecycle).toBe("function");
  });
});

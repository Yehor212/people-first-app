import { describe, expect, it } from "vitest";

import { resolveAppUpdateCapability } from "@/lib/appUpdateCapability";

describe("app update capability", () => {
  it("uses the implemented Google Play path only for native Android", () => {
    expect(
      resolveAppUpdateCapability({ native: true, platform: "android", tauri: false }),
    ).toEqual({ kind: "android-store" });
  });

  it("uses the implemented reload path for Web and installed PWAs", () => {
    expect(
      resolveAppUpdateCapability({ native: false, platform: "web", tauri: false }),
    ).toEqual({ kind: "web-reload" });
  });

  it.each([
    { native: true, platform: "ios" as const, tauri: false },
    { native: false, platform: "web" as const, tauri: true },
  ])("does not claim an updater for unsupported runtime $platform/$tauri", (runtime) => {
    expect(resolveAppUpdateCapability(runtime)).toEqual({ kind: "unavailable" });
  });
});

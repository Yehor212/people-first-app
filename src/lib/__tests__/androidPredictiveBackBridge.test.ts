import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Android predictive Back bridge contract", () => {
  it("registers one lifecycle-bound AndroidX callback and exposes bounded state", () => {
    const plugin = read("android/app/src/main/java/com/zenflow/app/AndroidBackPlugin.java");
    const activity = read("android/app/src/main/java/com/zenflow/app/MainActivity.java");

    expect(plugin).toContain('@CapacitorPlugin(name = "AndroidBack")');
    expect(plugin).toContain("new OnBackPressedCallback(true)");
    expect(plugin).toContain("getOnBackPressedDispatcher().addCallback(getActivity(), backCallback)");
    expect(plugin).toContain('notifyListeners("backInvoked"');
    expect(plugin).toContain('event.put("hadVisibleLayer", navigationState.hasVisibleLayer())');
    expect(plugin).toContain("backCallback.setEnabled(canConsume)");
    expect(plugin).toContain("protected void handleOnResume()");
    expect(plugin).toContain("backCallback.setEnabled(navigationState.canConsume())");
    expect(plugin).toContain("protected void handleOnDestroy()");
    expect(plugin).toContain("backCallback.remove()");
    expect(plugin).not.toMatch(/\bonBackPressed\s*\(/);
    expect(plugin).not.toContain("KEYCODE_BACK");
    expect(activity).toContain("registerPlugin(AndroidBackPlugin.class);");
  });

  it("disables Capacitor's competing handler and binds the TypeScript bridge", () => {
    const capacitorConfig = read("capacitor.config.ts");
    const bridge = read("src/lib/androidBackBridge.ts");
    const handler = read("src/lib/androidBackHandler.ts");

    expect(capacitorConfig).toContain("App: {");
    expect(capacitorConfig).toContain("disableBackButtonHandler: true");
    expect(bridge).toContain("registerPlugin<AndroidBackNativePlugin>(\"AndroidBack\")");
    expect(bridge).toContain("hasVisibleLayer: boolean");
    expect(bridge).toContain("hadVisibleLayer?: boolean");
    expect(handler).toContain('AndroidBackBridge.addListener("backInvoked"');
    expect(handler).not.toContain('App.addListener("backButton"');
    expect(handler).not.toContain("App.exitApp");
  });
});

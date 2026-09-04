import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pluginSource = readFileSync(
  resolve("android/app/src/main/java/com/zenflow/app/StatusBarStylePlugin.java"),
  "utf8",
);

describe("Android status-bar visual-state ownership", () => {
  it("waits for the current WebView frame before applying icon appearance", () => {
    expect(pluginSource).toContain("getBridge().getWebView()");
    expect(pluginSource).toContain("webView.postVisualStateCallback(");
    expect(pluginSource).toContain("webView.postOnAnimation(() -> {");
    expect(pluginSource).toContain("applyStatusBarStyle(activity, style)");
    expect(pluginSource).toMatch(
      /postVisualStateCallback\([\s\S]*?onComplete\([\s\S]*?postOnAnimation\([\s\S]*?applyStatusBarStyle\(activity, style\)/,
    );
  });

  it("drops stale rapid-toggle callbacks without leaving bridge calls pending", () => {
    expect(pluginSource).toContain("private long latestVisualStateRequestId = 0L;");
    expect(pluginSource).toContain("final long requestId = ++latestVisualStateRequestId;");
    expect(pluginSource).toMatch(
      /if \(requestId != latestVisualStateRequestId\) \{\s*resolveCall\(call\);\s*return;/,
    );
  });

  it("resolves an unchanged explicit style before requesting another WebView frame", () => {
    expect(pluginSource).toMatch(
      /if \(style\.equals\(lastAppliedStyle\)\) \{\s*resolveCall\(call\);\s*return;/,
    );
    const duplicateGuard = pluginSource.indexOf("if (style.equals(lastAppliedStyle))");
    const visualStateRequest = pluginSource.indexOf("scheduleStatusBarStyleAfterVisualState(style, call)");
    expect(duplicateGuard).toBeGreaterThanOrEqual(0);
    expect(duplicateGuard).toBeLessThan(visualStateRequest);
  });

  it("reapplies the current style after every Android configuration change", () => {
    expect(pluginSource).toContain(
      "scheduleStatusBarStyleAfterVisualState(currentStyle, null)",
    );
    expect(pluginSource).not.toMatch(
      /if \("DEFAULT"\.equals\(currentStyle\)\) \{\s*getBridge\(\)\.executeOnMainThread/,
    );
  });
});

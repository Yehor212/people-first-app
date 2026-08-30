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

  it("uses the same frame boundary when DEFAULT follows an Android configuration change", () => {
    expect(pluginSource).toContain(
      "scheduleStatusBarStyleAfterVisualState(currentStyle, null)",
    );
  });
});

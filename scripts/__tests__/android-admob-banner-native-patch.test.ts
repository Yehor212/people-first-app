import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const bannerExecutorPath = resolve(
  root,
  "node_modules/@capacitor-community/admob/android/src/main/java/com/getcapacitor/community/admob/banner/BannerExecutor.java",
);
const adOptionsPath = resolve(
  root,
  "node_modules/@capacitor-community/admob/android/src/main/java/com/getcapacitor/community/admob/models/AdOptions.java",
);
const adViewIdHelperPath = resolve(
  root,
  "node_modules/@capacitor-community/admob/android/src/main/java/com/getcapacitor/community/admob/helpers/AdViewIdHelper.java",
);
const patchPath = resolve(root, "patches/@capacitor-community+admob+8.0.0.patch");

describe("Android AdMob banner edge-to-edge patch", () => {
  it("keeps the insets listener on the banner container instead of Android DecorView", () => {
    const source = readFileSync(bannerExecutorPath, "utf8");

    expect(source).toContain("mAdViewLayout.setOnApplyWindowInsetsListener");
    expect(source).not.toContain(
      "activitySupplier.get().getWindow().getDecorView().setOnApplyWindowInsetsListener",
    );
    expect(source).not.toMatch(
      /View rootView = activitySupplier\.get\(\)\.getWindow\(\)\.getDecorView\(\);\s*rootView\.setOnApplyWindowInsetsListener/,
    );
  });

  it("destroys and detaches the native banner before removeBanner resolves", () => {
    const source = readFileSync(bannerExecutorPath, "utf8");

    expect(source).toContain("mAdViewLayout.setOnApplyWindowInsetsListener(null)");
    expect(source).toContain("mAdViewLayout = null;");
    expect(source).toMatch(
      /public void removeBanner[\s\S]*runOnUiThread\(\(\) -> \{[\s\S]*mAdView\.destroy\(\);[\s\S]*call\.resolve\(\);[\s\S]*\}\);/,
    );
  });

  it("bounds both the native container and AdView to the measured adaptive banner", () => {
    const source = readFileSync(bannerExecutorPath, "utf8");

    expect(source).toContain("final int adWidthPixels = mAdView.getAdSize().getWidthInPixels");
    expect(source).toContain("final int adHeightPixels = mAdView.getAdSize().getHeightInPixels");
    expect(source).toContain(
      "new CoordinatorLayout.LayoutParams(adWidthPixels, adHeightPixels)",
    );
    expect(source).toContain("RelativeLayout.LayoutParams.MATCH_PARENT");
    expect(source).toContain("mAdViewLayout.addView(mAdView, adViewLayoutParams)");
    expect(source).not.toContain("adViewLayoutParams.addRule(RelativeLayout.CENTER_IN_PARENT)");
  });

  it("sizes an adaptive banner to the inset-aware Capacitor content width", () => {
    const source = readFileSync(bannerExecutorPath, "utf8");

    expect(source).toContain(
      "int availableWidthPixels = mViewGroup.getWidth() > 0 ? mViewGroup.getWidth() : defaultWidthPixels",
    );
    expect(source).toContain("(int) (availableWidthPixels / density)");
    expect(source).not.toContain("(int) (defaultWidthPixels / density)");
  });

  it("ships the fix through patch-package after every clean install", () => {
    const patch = readFileSync(patchPath, "utf8");

    expect(patch).toContain("mAdViewLayout.setOnApplyWindowInsetsListener");
    expect(patch).toContain("mAdViewLayout.setOnApplyWindowInsetsListener(null)");
    expect(patch).toContain("new CoordinatorLayout.LayoutParams(adWidthPixels, adHeightPixels)");
    expect(patch).toContain("RelativeLayout.LayoutParams.MATCH_PARENT");
    expect(patch).toContain("availableWidthPixels = mViewGroup.getWidth()");
    expect(patch).toContain("mAdViewLayout.addView(mAdView, adViewLayoutParams)");
    expect(patch).toContain("Test ad requests are disabled in ZenFlow production builds");
    expect(patch).toContain("A real adId is required in ZenFlow production builds");
  });

  it("fails closed instead of embedding or selecting sample ad unit ids", () => {
    const options = readFileSync(adOptionsPath, "utf8");
    const helper = readFileSync(adViewIdHelperPath, "utf8");

    expect(options).not.toContain("ca-app-pub-3940256099942544");
    expect(options).toContain("Test ad requests are disabled in ZenFlow production builds");
    expect(options).toContain("A real adId is required in ZenFlow production builds");
    expect(helper).not.toContain("getTestingId");
    expect(helper).toContain("return adOptions.adId;");
  });
});

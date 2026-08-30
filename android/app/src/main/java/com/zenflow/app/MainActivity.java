package com.zenflow.app;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewTreeObserver;
import android.webkit.WebView;
import androidx.activity.EdgeToEdge;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

    private boolean edgeBackdropDark = true;

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {
        // Marker interface required by @capgo/capacitor-social-login for Google scopes
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Defer the throwaway-WebView cache clear until after the first frame so
        // version updates no longer pay WebView process init on the critical path.
        deferWebViewCacheClearOnUpdate();

        enableNativeEdgeToEdge();

        // Register local plugins before Capacitor creates the bridge.
        registerPlugin(WidgetPlugin.class);
        registerPlugin(ReviewPlugin.class);
        registerPlugin(AppUpdatePlugin.class);
        registerPlugin(DndPlugin.class);
        registerPlugin(BiometricAuthPlugin.class);
        registerPlugin(ScreenSecurityPlugin.class);
        registerPlugin(StatusBarStylePlugin.class);
        registerPlugin(PushRealmPlugin.class);

        super.onCreate(savedInstanceState);
        // WebView 113+ automatically enables inspection for debuggable apps. Re-apply the
        // explicit flag after Capacitor so release-like builds expose it only for benchmarks.
        WebView.setWebContentsDebuggingEnabled(BuildConfig.ZENFLOW_ANDROID_MOTION_BENCHMARK);
        enableNativeEdgeToEdge();
    }

    private void enableNativeEdgeToEdge() {
        EdgeToEdge.enable(this);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        applyNativeEdgeBackdrop();
        getWindow().getDecorView().post(this::applyNativeEdgeBackdrop);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
    }

    private void applyNativeEdgeBackdrop() {
        // Launches always start dark to match the splash; the web theme
        // (StatusBarStyle.setStyle) may switch gutters during the session.
        int backdrop = edgeBackdropDark
                ? R.drawable.zenflow_edge_bleed_backdrop_night
                : R.drawable.zenflow_edge_bleed_backdrop;
        getWindow().setBackgroundDrawableResource(backdrop);
        getWindow().getDecorView().setBackgroundResource(backdrop);
    }

    /** Called by StatusBarStylePlugin so gutters track the web theme within a session. */
    public void setNativeEdgeBackdropDark(boolean dark) {
        edgeBackdropDark = dark;
        applyNativeEdgeBackdrop();
    }

    @Override
    public void onResume() {
        super.onResume();
        enableNativeEdgeToEdge();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        enableNativeEdgeToEdge();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }

    /**
     * Clear WebView cache when the app version changes.
     * Prevents stale JS bundles from being served after APK updates.
     */
    private void deferWebViewCacheClearOnUpdate() {
        try {
            SharedPreferences prefs = getSharedPreferences("zenflow_webview", MODE_PRIVATE);
            String lastVersion = prefs.getString("last_web_version", "");
            PackageInfo pInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
            String currentVersion = pInfo.versionName;

            if (currentVersion.equals(lastVersion)) {
                return;
            }

            // Version changed — clear the WebView cache after the first frame instead
            // of blocking onCreate with a throwaway WebView on every update launch.
            final View decor = getWindow().getDecorView();
            decor.getViewTreeObserver().addOnPreDrawListener(new ViewTreeObserver.OnPreDrawListener() {
                @Override
                public boolean onPreDraw() {
                    decor.getViewTreeObserver().removeOnPreDrawListener(this);
                    decor.post(() -> {
                        try {
                            WebView tempWebView = new WebView(MainActivity.this);
                            tempWebView.clearCache(true);
                            tempWebView.destroy();
                            prefs.edit().putString("last_web_version", currentVersion).apply();
                        } catch (Exception ignored) {
                            // Non-critical — stale assets are tolerable over a delayed start.
                        }
                    });
                    return true;
                }
            });
        } catch (Exception e) {
            // Non-critical — if cache clearing fails, app still works (just with potential stale assets)
        }
    }

}

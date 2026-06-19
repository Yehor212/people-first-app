package com.zenflow.app;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.EdgeToEdge;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {
        // Marker interface required by @capgo/capacitor-social-login for Google scopes
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Clear WebView cache on app version change to prevent stale JS bundles
        clearWebViewCacheOnUpdate();

        enableNativeEdgeToEdge();

        // Register local plugins before Capacitor creates the bridge.
        registerPlugin(WidgetPlugin.class);
        registerPlugin(ReviewPlugin.class);
        registerPlugin(AppUpdatePlugin.class);
        registerPlugin(DndPlugin.class);
        registerPlugin(BiometricAuthPlugin.class);
        registerPlugin(ScreenSecurityPlugin.class);
        registerPlugin(StatusBarStylePlugin.class);

        super.onCreate(savedInstanceState);
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
        getWindow().setBackgroundDrawableResource(R.drawable.zenflow_edge_bleed_backdrop);
        getWindow().getDecorView().setBackgroundResource(R.drawable.zenflow_edge_bleed_backdrop);
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
    private void clearWebViewCacheOnUpdate() {
        try {
            SharedPreferences prefs = getSharedPreferences("zenflow_webview", MODE_PRIVATE);
            String lastVersion = prefs.getString("last_web_version", "");
            PackageInfo pInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
            String currentVersion = pInfo.versionName;

            if (!currentVersion.equals(lastVersion)) {
                // Version changed — clear WebView cache before bridge creates the WebView
                WebView tempWebView = new WebView(this);
                tempWebView.clearCache(true);
                tempWebView.destroy();

                prefs.edit().putString("last_web_version", currentVersion).apply();
            }
        } catch (Exception e) {
            // Non-critical — if cache clearing fails, app still works (just with potential stale assets)
        }
    }

}

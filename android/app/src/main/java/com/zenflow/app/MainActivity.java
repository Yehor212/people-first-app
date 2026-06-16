package com.zenflow.app;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.EdgeToEdge;
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

        // Enable edge-to-edge display (required for targetSdk 35 / Android 15+)
        EdgeToEdge.enable(this);

        // Register local plugins before Capacitor creates the bridge.
        registerPlugin(WidgetPlugin.class);
        registerPlugin(ReviewPlugin.class);
        registerPlugin(AppUpdatePlugin.class);
        registerPlugin(DndPlugin.class);
        registerPlugin(ScreenSecurityPlugin.class);
        registerPlugin(StatusBarStylePlugin.class);

        super.onCreate(savedInstanceState);
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

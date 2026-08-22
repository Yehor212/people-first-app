package com.zenflow.app;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
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
        registerPlugin(AndroidBackPlugin.class);

        super.onCreate(savedInstanceState);
        clearWebViewCacheOnUpdate();
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
        StatusBarStylePlugin.applyCurrentEdgeBackdrop(this);
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

            if (!currentVersion.equals(lastVersion) && getBridge() != null && getBridge().getWebView() != null) {
                // Reuse the initialized bridge WebView; creating a temporary WebView before
                // Activity initialization adds startup work and can violate lifecycle assumptions.
                getBridge().getWebView().clearCache(true);
                prefs.edit().putString("last_web_version", currentVersion).apply();
            }
        } catch (Exception ignored) {
            Log.w("ZenFlowStartup", "WEBVIEW_CACHE_CLEAR_FAILED");
        }
    }

}

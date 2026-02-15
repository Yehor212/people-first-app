package com.zenflow.app;

import android.content.Intent;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {
        // Marker interface required by @capgo/capacitor-social-login for Google scopes
    }

    // P0 Fix #6: Store pending intent for OAuth callbacks that arrive before bridge is ready
    private Intent pendingDeepLinkIntent = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Enable edge-to-edge display (required for targetSdk 35 / Android 15+)
        EdgeToEdge.enable(this);

        // P0 Fix #5: Call super.onCreate() FIRST before registering plugins
        // This ensures the Capacitor Bridge is properly initialized
        super.onCreate(savedInstanceState);

        // Register plugins AFTER bridge initialization
        registerPlugin(WidgetPlugin.class);
        registerPlugin(ReviewPlugin.class);
        registerPlugin(AppUpdatePlugin.class);
        registerPlugin(DndPlugin.class);

        // P0 Fix #6: Process any pending deep link intent after bridge is ready
        if (pendingDeepLinkIntent != null) {
            handleDeepLinkIntent(pendingDeepLinkIntent);
            pendingDeepLinkIntent = null;
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);

        // P0 Fix #6: Check if this is a deep link (OAuth callback)
        if (intent != null && intent.getData() != null) {
            handleDeepLinkIntent(intent);
        }
    }

    /**
     * P0 Fix #6: Handle deep link intent, storing it if bridge isn't ready yet
     */
    private void handleDeepLinkIntent(Intent intent) {
        if (this.bridge != null) {
            // Bridge is ready, forward the intent immediately
            this.bridge.onNewIntent(intent);
        } else {
            // Bridge not ready yet, store for later processing
            // This can happen if OAuth callback returns very quickly
            pendingDeepLinkIntent = intent;
        }
    }
}

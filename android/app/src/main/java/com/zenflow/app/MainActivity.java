package com.zenflow.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetPlugin.class);
        registerPlugin(ReviewPlugin.class);
        registerPlugin(AppUpdatePlugin.class);
        registerPlugin(HealthConnectPlugin.class);
        registerPlugin(DndPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Forward deep link intent to Capacitor bridge for OAuth callback handling
        setIntent(intent);
        if (this.bridge != null) {
            this.bridge.onNewIntent(intent);
        }
    }
}

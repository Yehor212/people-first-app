package com.zenflow.app;

import android.app.Activity;
import android.view.Window;
import android.view.WindowManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ScreenSecurity")
public class ScreenSecurityPlugin extends Plugin {

    @PluginMethod
    public void enable(PluginCall call) {
        setFlagSecure(call, true);
    }

    @PluginMethod
    public void disable(PluginCall call) {
        setFlagSecure(call, false);
    }

    private void setFlagSecure(PluginCall call, boolean enabled) {
        getBridge().executeOnMainThread(() -> {
            Activity activity = getActivity();
            if (activity == null) {
                call.reject("Activity not available");
                return;
            }

            Window window = activity.getWindow();
            if (enabled) {
                window.addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            } else {
                window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            }
            call.resolve();
        });
    }
}

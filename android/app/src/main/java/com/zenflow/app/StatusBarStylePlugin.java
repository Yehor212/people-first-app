package com.zenflow.app;

import android.content.res.Configuration;
import android.view.View;
import android.view.Window;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

/**
 * Minimal StatusBar style plugin — replaces @capacitor/status-bar
 * to eliminate deprecated Window.getStatusBarColor() / setStatusBarColor() calls.
 *
 * ONLY exposes setStyle() using modern WindowInsetsControllerCompat API.
 * No background color, no overlay, no hide/show — ZenFlow doesn't need them.
 */
@CapacitorPlugin(name = "StatusBarStyle")
public class StatusBarStylePlugin extends Plugin {

    private String currentStyle = "DEFAULT";

    @PluginMethod
    public void setStyle(PluginCall call) {
        String style = call.getString("style", "DEFAULT");

        getBridge().executeOnMainThread(() -> {
            try {
                currentStyle = style;
                String resolvedStyle = style;

                if ("DEFAULT".equals(resolvedStyle)) {
                    int nightMode = getActivity().getResources().getConfiguration().uiMode
                            & Configuration.UI_MODE_NIGHT_MASK;
                    resolvedStyle = (nightMode == Configuration.UI_MODE_NIGHT_YES) ? "DARK" : "LIGHT";
                }

                Window window = getActivity().getWindow();
                View decorView = window.getDecorView();
                WindowInsetsControllerCompat controller =
                        WindowCompat.getInsetsController(window, decorView);
                controller.setAppearanceLightStatusBars(!"DARK".equals(resolvedStyle));

                call.resolve();
            } catch (Exception e) {
                call.reject("Failed to set status bar style: " + e.getMessage());
            }
        });
    }

    @Override
    protected void handleOnConfigurationChanged(Configuration newConfig) {
        super.handleOnConfigurationChanged(newConfig);
        // Re-apply style when system theme changes (only matters for DEFAULT)
        if ("DEFAULT".equals(currentStyle)) {
            int nightMode = newConfig.uiMode & Configuration.UI_MODE_NIGHT_MASK;
            String resolved = (nightMode == Configuration.UI_MODE_NIGHT_YES) ? "DARK" : "LIGHT";
            try {
                Window window = getActivity().getWindow();
                View decorView = window.getDecorView();
                WindowInsetsControllerCompat controller =
                        WindowCompat.getInsetsController(window, decorView);
                controller.setAppearanceLightStatusBars(!"DARK".equals(resolved));
            } catch (Exception ignored) {
                // Non-critical — worst case status bar icons wrong color
            }
        }
    }
}

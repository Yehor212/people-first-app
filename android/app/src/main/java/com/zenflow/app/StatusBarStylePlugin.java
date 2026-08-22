package com.zenflow.app;

import android.app.Activity;
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
 * Exposes setStyle() using modern WindowInsetsControllerCompat API and keeps
 * the transparent system-bar backdrop aligned with the selected app theme.
 * No opaque system-bar color, overlay, or hide/show behavior is introduced.
 */
@CapacitorPlugin(name = "StatusBarStyle")
public class StatusBarStylePlugin extends Plugin {

    private static volatile String currentStyle = "DEFAULT";

    private static boolean resolvesToDarkTheme(Activity activity, String style) {
        if ("DARK".equals(style)) return true;
        if ("LIGHT".equals(style)) return false;

        int nightMode = activity.getResources().getConfiguration().uiMode
                & Configuration.UI_MODE_NIGHT_MASK;
        return nightMode == Configuration.UI_MODE_NIGHT_YES;
    }

    private static void applyResolvedStyle(Activity activity, String style) {
        boolean darkTheme = resolvesToDarkTheme(activity, style);
        Window window = activity.getWindow();
        View decorView = window.getDecorView();
        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(window, decorView);
        controller.setAppearanceLightStatusBars(!darkTheme);
        controller.setAppearanceLightNavigationBars(!darkTheme);

        int backdropResource = darkTheme
                ? R.drawable.zenflow_edge_bleed_backdrop_dark
                : R.drawable.zenflow_edge_bleed_backdrop;
        window.setBackgroundDrawableResource(backdropResource);
        decorView.setBackgroundResource(backdropResource);
    }

    static void applyCurrentEdgeBackdrop(Activity activity) {
        applyResolvedStyle(activity, currentStyle);
    }

    @PluginMethod
    public void setStyle(PluginCall call) {
        String style = call.getString("style", "DEFAULT");

        getBridge().executeOnMainThread(() -> {
            try {
                android.app.Activity activity = getActivity();
                if (activity == null) {
                    call.reject("Activity not available");
                    return;
                }

                currentStyle = style;
                applyResolvedStyle(activity, style);

                call.resolve();
            } catch (Exception e) {
                call.reject("Failed to set status bar style: " + e.getMessage());
            }
        });
    }

    @Override
    protected void handleOnConfigurationChanged(Configuration newConfig) {
        super.handleOnConfigurationChanged(newConfig);
        Activity activity = getActivity();
        if (activity == null) return;

        try {
            applyCurrentEdgeBackdrop(activity);
        } catch (Exception ignored) {
            // Non-critical — the next theme application or activity resume retries.
        }
    }
}

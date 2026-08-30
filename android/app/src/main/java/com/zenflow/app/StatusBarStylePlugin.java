package com.zenflow.app;

import android.app.Activity;
import android.content.res.Configuration;
import android.view.View;
import android.view.Window;
import android.webkit.WebView;

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
    private long latestVisualStateRequestId = 0L;

    @PluginMethod
    public void setStyle(PluginCall call) {
        final String style = call.getString("style", "DEFAULT");

        getBridge().executeOnMainThread(() -> {
            try {
                Activity activity = getActivity();
                if (activity == null) {
                    call.reject("Activity not available");
                    return;
                }

                currentStyle = style;
                scheduleStatusBarStyleAfterVisualState(style, call);
            } catch (Exception e) {
                call.reject("Failed to set status bar style: " + e.getMessage());
            }
        });
    }

    private void scheduleStatusBarStyleAfterVisualState(String style, PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            rejectCall(call, "Activity not available");
            return;
        }

        if (getBridge() == null) {
            rejectCall(call, "Bridge not available");
            return;
        }

        WebView webView = getBridge().getWebView();
        if (webView == null) {
            rejectCall(call, "WebView not available");
            return;
        }

        final long requestId = ++latestVisualStateRequestId;
        webView.postVisualStateCallback(requestId, new WebView.VisualStateCallback() {
            @Override
            public void onComplete(long completedRequestId) {
                try {
                    if (requestId != latestVisualStateRequestId) {
                        resolveCall(call);
                        return;
                    }

                    webView.postOnAnimation(() -> {
                        try {
                            if (requestId != latestVisualStateRequestId) {
                                resolveCall(call);
                                return;
                            }

                            applyStatusBarStyle(activity, style);
                            resolveCall(call);
                        } catch (Exception e) {
                            rejectCall(call, "Failed to set status bar style: " + e.getMessage());
                        }
                    });
                } catch (Exception e) {
                    rejectCall(call, "Failed to set status bar style: " + e.getMessage());
                }
            }
        });
    }

    private void applyStatusBarStyle(Activity activity, String style) {
        String resolvedStyle = style;
        if ("DEFAULT".equals(resolvedStyle)) {
            int nightMode = activity.getResources().getConfiguration().uiMode
                    & Configuration.UI_MODE_NIGHT_MASK;
            resolvedStyle = (nightMode == Configuration.UI_MODE_NIGHT_YES) ? "DARK" : "LIGHT";
        }

        Window window = activity.getWindow();
        View decorView = window.getDecorView();
        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(window, decorView);
        controller.setAppearanceLightStatusBars(!"DARK".equals(resolvedStyle));
    }

    private void resolveCall(PluginCall call) {
        if (call != null) {
            call.resolve();
        }
    }

    private void rejectCall(PluginCall call, String message) {
        if (call != null) {
            call.reject(message);
        }
    }

    @Override
    protected void handleOnConfigurationChanged(Configuration newConfig) {
        super.handleOnConfigurationChanged(newConfig);
        // Re-apply style when system theme changes (only matters for DEFAULT)
        if ("DEFAULT".equals(currentStyle)) {
            getBridge().executeOnMainThread(
                    () -> scheduleStatusBarStyleAfterVisualState(currentStyle, null));
        }
    }
}

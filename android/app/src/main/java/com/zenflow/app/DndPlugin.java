package com.zenflow.app;

import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * DND (Do Not Disturb) Plugin for ZenFlow
 *
 * Checks if the device is in Do Not Disturb mode.
 * Used to skip or modify notification behavior when DND is active.
 */
@CapacitorPlugin(name = "Dnd")
public class DndPlugin extends Plugin {
    private static final String TAG = "DndPlugin";

    /**
     * Check if Do Not Disturb mode is currently active
     */
    @PluginMethod
    public void isDndActive(PluginCall call) {
        JSObject result = new JSObject();

        try {
            Context context = getContext();
            NotificationManager notificationManager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

            if (notificationManager == null) {
                result.put("active", false);
                result.put("error", "NotificationManager not available");
                call.resolve(result);
                return;
            }

            // Check DND status (API 23+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                int filter = notificationManager.getCurrentInterruptionFilter();

                // INTERRUPTION_FILTER_ALL = 1 (allow all)
                // INTERRUPTION_FILTER_PRIORITY = 2 (priority only)
                // INTERRUPTION_FILTER_NONE = 3 (total silence)
                // INTERRUPTION_FILTER_ALARMS = 4 (alarms only)

                boolean isDndActive = filter != NotificationManager.INTERRUPTION_FILTER_ALL;

                result.put("active", isDndActive);
                result.put("filter", filter);
                result.put("filterName", getFilterName(filter));

                Log.d(TAG, "DND check - active: " + isDndActive + ", filter: " + filter);
            } else {
                // Pre-Marshmallow: DND check not available
                result.put("active", false);
                result.put("filter", 1);
                result.put("filterName", "all");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error checking DND status", e);
            result.put("active", false);
            result.put("error", e.getMessage());
        }

        call.resolve(result);
    }

    /**
     * Get current DND filter details
     */
    @PluginMethod
    public void getDndStatus(PluginCall call) {
        JSObject result = new JSObject();

        try {
            Context context = getContext();
            NotificationManager notificationManager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

            if (notificationManager == null) {
                result.put("available", false);
                call.resolve(result);
                return;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                int filter = notificationManager.getCurrentInterruptionFilter();

                result.put("available", true);
                result.put("filter", filter);
                result.put("filterName", getFilterName(filter));
                result.put("allowAll", filter == NotificationManager.INTERRUPTION_FILTER_ALL);
                result.put("priorityOnly", filter == NotificationManager.INTERRUPTION_FILTER_PRIORITY);
                result.put("alarmsOnly", filter == NotificationManager.INTERRUPTION_FILTER_ALARMS);
                result.put("totalSilence", filter == NotificationManager.INTERRUPTION_FILTER_NONE);
            } else {
                result.put("available", false);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error getting DND status", e);
            result.put("available", false);
            result.put("error", e.getMessage());
        }

        call.resolve(result);
    }

    /**
     * Check if notification policy access is granted
     * (Required for modifying DND settings, not for reading)
     */
    @PluginMethod
    public void hasNotificationPolicyAccess(PluginCall call) {
        JSObject result = new JSObject();

        try {
            Context context = getContext();
            NotificationManager notificationManager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

            if (notificationManager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                result.put("granted", notificationManager.isNotificationPolicyAccessGranted());
            } else {
                result.put("granted", false);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error checking notification policy access", e);
            result.put("granted", false);
        }

        call.resolve(result);
    }

    /**
     * Convert filter code to human-readable name
     */
    private String getFilterName(int filter) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            switch (filter) {
                case NotificationManager.INTERRUPTION_FILTER_ALL:
                    return "all";
                case NotificationManager.INTERRUPTION_FILTER_PRIORITY:
                    return "priority";
                case NotificationManager.INTERRUPTION_FILTER_NONE:
                    return "none";
                case NotificationManager.INTERRUPTION_FILTER_ALARMS:
                    return "alarms";
                default:
                    return "unknown";
            }
        }
        return "unknown";
    }
}

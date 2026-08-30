package com.zenflow.app;

import android.app.NotificationManager;

final class NotificationChannelContract {
    private NotificationChannelContract() {}

    static Profile profileFor(String channelId) {
        return switch (channelId) {
            case "zenflow_default_v4" -> new Profile(
                NotificationManager.IMPORTANCE_DEFAULT,
                true,
                "default"
            );
            case "zenflow_furin_v5" -> new Profile(
                NotificationManager.IMPORTANCE_DEFAULT,
                true,
                "zenflow_furin"
            );
            case "zenflow_gentle_v4" -> new Profile(
                NotificationManager.IMPORTANCE_LOW,
                true,
                null
            );
            case "zenflow_silent_v4" -> new Profile(
                NotificationManager.IMPORTANCE_MIN,
                false,
                null
            );
            default -> throw new IllegalArgumentException("Unknown notification channel");
        };
    }

    record Profile(int importance, boolean vibration, String soundResourceName) {}
}

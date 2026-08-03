package com.zenflow.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.media.RingtoneManager;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.text.BidiFormatter;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Locale;
import java.util.Map;

public class ZenFlowMessagingService extends FirebaseMessagingService {
    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        PushDeliveryPermit.executeAuthorized(
            () -> PushRealmPlugin.readRealmState(this),
            data,
            () -> {
                PushNotificationsPlugin.sendRemoteMessage(remoteMessage);
                PushDeliveryPermit.RealmState state = PushRealmPlugin.readRealmState(this);
                if (state != null) displayRealmBoundNotification(state, data);
            }
        );
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        PushNotificationsPlugin.onNewToken(token);
    }

    private void displayRealmBoundNotification(
        PushDeliveryPermit.RealmState state,
        Map<String, String> data
    ) {
        String kind = data.get(PushDeliveryPermit.NOTIFICATION_KIND_KEY);
        Context localizedContext = localizedContext(state.language());
        String title = localizedContext.getString(titleResource(kind));
        String body = localizedContext.getString(bodyResource(kind));
        Locale locale = Locale.forLanguageTag(state.language());
        BidiFormatter bidi = BidiFormatter.getInstance(locale);

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        ensureChannel(manager, localizedContext, state.channelId());

        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launchIntent == null) return;
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        launchIntent.putExtra(PushDeliveryPermit.NOTIFICATION_KIND_KEY, kind);
        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            notificationId(kind),
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, state.channelId())
            .setSmallIcon(R.mipmap.ic_launcher_foreground)
            .setContentTitle(bidi.unicodeWrap(title))
            .setContentText(bidi.unicodeWrap(body))
            .setStyle(new NotificationCompat.BigTextStyle().bigText(bidi.unicodeWrap(body)))
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setVisibility(NotificationCompat.VISIBILITY_SECRET)
            .build();
        manager.notify(notificationId(kind), notification);
    }

    private Context localizedContext(String language) {
        Configuration configuration = new Configuration(getResources().getConfiguration());
        configuration.setLocale(Locale.forLanguageTag(language));
        return createConfigurationContext(configuration);
    }

    private void ensureChannel(
        NotificationManager manager,
        Context localizedContext,
        String channelId
    ) {
        int importance = NotificationManager.IMPORTANCE_DEFAULT;
        boolean vibration = true;
        if ("zenflow_gentle_v4".equals(channelId)) {
            importance = NotificationManager.IMPORTANCE_LOW;
        } else if ("zenflow_silent_v4".equals(channelId)) {
            importance = NotificationManager.IMPORTANCE_MIN;
            vibration = false;
        }

        NotificationChannel channel = new NotificationChannel(
            channelId,
            localizedContext.getString(channelNameResource(channelId)),
            importance
        );
        channel.setDescription(
            localizedContext.getString(channelDescriptionResource(channelId))
        );
        channel.setLockscreenVisibility(Notification.VISIBILITY_SECRET);
        channel.enableVibration(vibration);
        if ("zenflow_default_v4".equals(channelId)) {
            channel.setSound(
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                null
            );
        } else {
            channel.setSound(null, null);
        }
        manager.createNotificationChannel(channel);
    }

    private int channelNameResource(String channelId) {
        return switch (channelId) {
            case "zenflow_default_v4" -> R.string.push_realm_channel_default;
            case "zenflow_gentle_v4" -> R.string.push_realm_channel_gentle;
            case "zenflow_silent_v4" -> R.string.push_realm_channel_silent;
            default -> throw new IllegalArgumentException("Unknown notification channel");
        };
    }

    private int channelDescriptionResource(String channelId) {
        return switch (channelId) {
            case "zenflow_default_v4" -> R.string.push_realm_channel_default_description;
            case "zenflow_gentle_v4" -> R.string.push_realm_channel_gentle_description;
            case "zenflow_silent_v4" -> R.string.push_realm_channel_silent_description;
            default -> throw new IllegalArgumentException("Unknown notification channel");
        };
    }

    private int titleResource(String kind) {
        return switch (kind) {
            case "mood" -> R.string.push_realm_mood_title;
            case "habit" -> R.string.push_realm_habit_title;
            case "focus" -> R.string.push_realm_focus_title;
            case "test" -> R.string.push_realm_test_title;
            default -> throw new IllegalArgumentException("Unknown notification kind");
        };
    }

    private int bodyResource(String kind) {
        return switch (kind) {
            case "mood" -> R.string.push_realm_mood_body;
            case "habit" -> R.string.push_realm_habit_body;
            case "focus" -> R.string.push_realm_focus_body;
            case "test" -> R.string.push_realm_test_body;
            default -> throw new IllegalArgumentException("Unknown notification kind");
        };
    }

    private int notificationId(String kind) {
        return switch (kind) {
            case "mood" -> 7101;
            case "habit" -> 7102;
            case "focus" -> 7103;
            case "test" -> 7104;
            default -> 7199;
        };
    }
}

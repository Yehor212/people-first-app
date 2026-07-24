package com.zenflow.app;

import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "PushRealm")
public class PushRealmPlugin extends Plugin {
    private static final String PREFERENCES_NAME = "zenflow_push_realm";
    private static final String INSTALLATION_ID = "installation_id";
    private static final String LANGUAGE = "language";
    private static final String CHANNEL_ID = "channel_id";

    @PluginMethod
    public void activate(PluginCall call) {
        PushDeliveryPermit.RealmState state = PushDeliveryPermit.readPersistedState(
            call.getString("installationId"),
            call.getString("language"),
            call.getString("channelId")
        );
        if (state == null) {
            call.reject("Invalid push realm");
            return;
        }

        AtomicBoolean committed = new AtomicBoolean(false);
        PushDeliveryPermit.withRealmLock(() -> committed.set(
            preferences(getContext())
                .edit()
                .putString(INSTALLATION_ID, state.installationId())
                .putString(LANGUAGE, state.language())
                .putString(CHANNEL_ID, state.channelId())
                .commit()
        ));
        if (!committed.get()) {
            call.reject("Push realm could not be saved");
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void suspend(PluginCall call) {
        AtomicBoolean committed = new AtomicBoolean(false);
        PushDeliveryPermit.withRealmLock(() -> {
            committed.set(preferences(getContext()).edit().clear().commit());
            if (committed.get()) {
                NotificationManager manager = getContext().getSystemService(NotificationManager.class);
                if (manager != null) manager.cancelAll();
            }
        });
        if (!committed.get()) {
            call.reject("Push realm could not be suspended");
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void updatePresentation(PluginCall call) {
        AtomicBoolean committed = new AtomicBoolean(false);
        AtomicBoolean accepted = new AtomicBoolean(false);
        PushDeliveryPermit.withRealmLock(() -> {
            PushDeliveryPermit.RealmState current = readRealmState(getContext());
            if (current == null) {
                accepted.set(true);
                committed.set(true);
                return;
            }
            PushDeliveryPermit.RealmState updated = PushDeliveryPermit.readPersistedState(
                current.installationId(),
                call.getString("language", current.language()),
                call.getString("channelId", current.channelId())
            );
            if (updated == null) return;
            accepted.set(true);
            committed.set(
                preferences(getContext())
                    .edit()
                    .putString(LANGUAGE, updated.language())
                    .putString(CHANNEL_ID, updated.channelId())
                    .commit()
            );
        });
        if (!accepted.get()) {
            call.reject("Push realm is not active");
            return;
        }
        if (!committed.get()) {
            call.reject("Push presentation could not be saved");
            return;
        }
        call.resolve();
    }

    static PushDeliveryPermit.RealmState readRealmState(Context context) {
        SharedPreferences stored = preferences(context);
        return PushDeliveryPermit.readPersistedState(
            stored.getString(INSTALLATION_ID, null),
            stored.getString(LANGUAGE, null),
            stored.getString(CHANNEL_ID, null)
        );
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
    }
}

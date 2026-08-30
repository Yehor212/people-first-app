package com.zenflow.app;

import java.nio.ByteBuffer;
import java.security.MessageDigest;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.regex.Pattern;

final class PushDeliveryPermit {
    static final Object REALM_LOCK = new Object();

    static final String DELIVERY_VERSION_KEY = "zenflow_delivery_version";
    static final String INSTALLATION_ID_KEY = "zenflow_install_id";
    static final String NOTIFICATION_KIND_KEY = "zenflow_notification_type";

    private static final String DELIVERY_VERSION = "1";
    private static final Pattern CANONICAL_UUID = Pattern.compile(
        "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    );
    private static final Set<String> LANGUAGES = Set.of(
        "en",
        "uk",
        "es",
        "de",
        "fr",
        "ja",
        "ar",
        "he"
    );
    private static final Set<String> CHANNEL_IDS = Set.of(
        "zenflow_default_v4",
        "zenflow_furin_v5",
        "zenflow_gentle_v4",
        "zenflow_silent_v4"
    );
    private static final Set<String> NOTIFICATION_KINDS = Set.of(
        "mood",
        "habit",
        "focus",
        "test"
    );
    private static final Set<String> MESSAGE_KEYS = Set.of(
        DELIVERY_VERSION_KEY,
        INSTALLATION_ID_KEY,
        NOTIFICATION_KIND_KEY
    );

    private PushDeliveryPermit() {}

    static RealmState readPersistedState(
        String installationId,
        String language,
        String channelId
    ) {
        if (
            !isCanonicalInstallationId(installationId) ||
            !isAllowedLanguage(language) ||
            !isAllowedChannel(channelId)
        ) {
            return null;
        }
        return new RealmState(installationId, language, channelId);
    }

    static boolean isCanonicalInstallationId(String installationId) {
        return installationId != null && CANONICAL_UUID.matcher(installationId).matches();
    }

    static boolean isAllowedLanguage(String language) {
        return language != null && LANGUAGES.contains(language);
    }

    static boolean isAllowedChannel(String channelId) {
        return channelId != null && CHANNEL_IDS.contains(channelId);
    }

    static boolean isAllowedNotificationKind(String kind) {
        return kind != null && NOTIFICATION_KINDS.contains(kind);
    }

    static boolean isAuthorized(RealmState state, Map<String, String> data) {
        if (
            !isValidState(state) ||
            data == null ||
            data.size() != MESSAGE_KEYS.size() ||
            !data.keySet().equals(MESSAGE_KEYS) ||
            !DELIVERY_VERSION.equals(data.get(DELIVERY_VERSION_KEY)) ||
            !isAllowedNotificationKind(data.get(NOTIFICATION_KIND_KEY))
        ) {
            return false;
        }

        String candidateInstallationId = data.get(INSTALLATION_ID_KEY);
        if (!isCanonicalInstallationId(candidateInstallationId)) {
            return false;
        }

        return MessageDigest.isEqual(
            uuidBytes(state.installationId()),
            uuidBytes(candidateInstallationId)
        );
    }

    private static boolean isValidState(RealmState state) {
        return state != null &&
            isCanonicalInstallationId(state.installationId()) &&
            isAllowedLanguage(state.language()) &&
            isAllowedChannel(state.channelId());
    }

    static boolean executeAuthorized(
        StateReader stateReader,
        Map<String, String> data,
        Runnable authorizedWork
    ) {
        if (stateReader == null || authorizedWork == null) {
            return false;
        }
        synchronized (REALM_LOCK) {
            RealmState state = stateReader.read();
            if (!isAuthorized(state, data)) {
                return false;
            }
            authorizedWork.run();
            return true;
        }
    }

    static void withRealmLock(Runnable action) {
        if (action == null) {
            throw new IllegalArgumentException("Realm action is required");
        }
        synchronized (REALM_LOCK) {
            action.run();
        }
    }

    static <T> T withRealmLock(Supplier<T> action) {
        if (action == null) {
            throw new IllegalArgumentException("Realm action is required");
        }
        synchronized (REALM_LOCK) {
            return action.get();
        }
    }

    private static byte[] uuidBytes(String value) {
        UUID uuid = UUID.fromString(value);
        return ByteBuffer.allocate(16)
            .putLong(uuid.getMostSignificantBits())
            .putLong(uuid.getLeastSignificantBits())
            .array();
    }

    interface StateReader {
        RealmState read();
    }

    record RealmState(String installationId, String language, String channelId) {}
}

package com.zenflow.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;

public class PushDeliveryPermitTest {
    private static final String INSTALLATION_A = "9d17e4c8-1fac-4b9f-a2d1-2df6d25e784a";
    private static final String INSTALLATION_B = "47dd9df8-3f85-42d7-8b88-66852f6f9d2c";

    @Test
    public void acceptsOnlyBoundedPersistedRealmState() {
        PushDeliveryPermit.RealmState state = PushDeliveryPermit.readPersistedState(
            INSTALLATION_A,
            "he",
            "zenflow_gentle_v4"
        );

        assertEquals(INSTALLATION_A, state.installationId());
        assertEquals("he", state.language());
        assertEquals("zenflow_gentle_v4", state.channelId());
        assertNull(PushDeliveryPermit.readPersistedState(null, "en", "zenflow_default_v4"));
        assertNull(PushDeliveryPermit.readPersistedState("not-a-uuid", "en", "zenflow_default_v4"));
        assertNull(PushDeliveryPermit.readPersistedState(INSTALLATION_A, "ru", "zenflow_default_v4"));
        assertNull(PushDeliveryPermit.readPersistedState(INSTALLATION_A, "en", "caller-channel"));

        for (String language : List.of("en", "uk", "es", "de", "fr", "ja", "ar", "he")) {
            assertEquals(
                language,
                PushDeliveryPermit.readPersistedState(
                    INSTALLATION_A,
                    language,
                    "zenflow_default_v4"
                ).language()
            );
        }
        for (String channel : List.of(
            "zenflow_default_v4",
            "zenflow_furin_v5",
            "zenflow_gentle_v4",
            "zenflow_silent_v4"
        )) {
            assertEquals(
                channel,
                PushDeliveryPermit.readPersistedState(INSTALLATION_A, "en", channel).channelId()
            );
        }
        for (String rejected : Arrays.asList("", " EN", "EN", "ru", null)) {
            assertNull(
                PushDeliveryPermit.readPersistedState(
                    INSTALLATION_A,
                    rejected,
                    "zenflow_default_v4"
                )
            );
        }
    }

    @Test
    public void authorizesOnlyExactVersionGenerationAndBoundedKind() {
        PushDeliveryPermit.RealmState state = PushDeliveryPermit.readPersistedState(
            INSTALLATION_A,
            "en",
            "zenflow_default_v4"
        );

        assertTrue(PushDeliveryPermit.isAuthorized(state, message(INSTALLATION_A, "habit")));
        assertFalse(PushDeliveryPermit.isAuthorized(state, message(INSTALLATION_B, "habit")));
        assertFalse(PushDeliveryPermit.isAuthorized(state, message(INSTALLATION_A.toUpperCase(), "habit")));
        assertFalse(PushDeliveryPermit.isAuthorized(state, message(INSTALLATION_A, "caller-kind")));

        Map<String, String> wrongVersion = message(INSTALLATION_A, "habit");
        wrongVersion.put("zenflow_delivery_version", "2");
        assertFalse(PushDeliveryPermit.isAuthorized(state, wrongVersion));

        Map<String, String> extraField = message(INSTALLATION_A, "habit");
        extraField.put("zenflow_title", "caller text");
        assertFalse(PushDeliveryPermit.isAuthorized(state, extraField));
        assertFalse(PushDeliveryPermit.isAuthorized(null, message(INSTALLATION_A, "habit")));

        for (String kind : List.of("mood", "habit", "focus", "test")) {
            assertTrue(PushDeliveryPermit.isAuthorized(state, message(INSTALLATION_A, kind)));
        }

        Map<String, String> missingKind = message(INSTALLATION_A, "habit");
        missingKind.remove("zenflow_notification_type");
        assertFalse(PushDeliveryPermit.isAuthorized(state, missingKind));

        Map<String, String> nullKind = message(INSTALLATION_A, "habit");
        nullKind.put("zenflow_notification_type", null);
        assertFalse(PushDeliveryPermit.isAuthorized(state, nullKind));
        assertFalse(PushDeliveryPermit.isAuthorized(state, null));

        PushDeliveryPermit.RealmState corruptId = new PushDeliveryPermit.RealmState(
            "not-a-uuid",
            "en",
            "zenflow_default_v4"
        );
        PushDeliveryPermit.RealmState corruptLanguage = new PushDeliveryPermit.RealmState(
            INSTALLATION_A,
            "ru",
            "zenflow_default_v4"
        );
        PushDeliveryPermit.RealmState corruptChannel = new PushDeliveryPermit.RealmState(
            INSTALLATION_A,
            "en",
            "caller-channel"
        );
        assertFalse(PushDeliveryPermit.isAuthorized(corruptId, message(INSTALLATION_A, "habit")));
        assertFalse(PushDeliveryPermit.isAuthorized(corruptLanguage, message(INSTALLATION_A, "habit")));
        assertFalse(PushDeliveryPermit.isAuthorized(corruptChannel, message(INSTALLATION_A, "habit")));
    }

    @Test
    public void displayThatEnteredFirstCompletesBeforeSuspendCancels() throws Exception {
        AtomicReference<PushDeliveryPermit.RealmState> state = new AtomicReference<>(
            PushDeliveryPermit.readPersistedState(INSTALLATION_A, "en", "zenflow_default_v4")
        );
        CountDownLatch displayEntered = new CountDownLatch(1);
        CountDownLatch releaseDisplay = new CountDownLatch(1);
        CountDownLatch suspendAttempting = new CountDownLatch(1);
        AtomicBoolean suspendEntered = new AtomicBoolean(false);
        List<String> events = new ArrayList<>();

        Thread display = new Thread(() ->
            PushDeliveryPermit.executeAuthorized(
                state::get,
                message(INSTALLATION_A, "mood"),
                () -> {
                    assertTrue(Thread.holdsLock(PushDeliveryPermit.REALM_LOCK));
                    events.add("forward");
                    displayEntered.countDown();
                    await(releaseDisplay);
                    events.add("display");
                }
            )
        );
        Thread suspend = new Thread(() -> {
            suspendAttempting.countDown();
            PushDeliveryPermit.withRealmLock(() -> {
                assertTrue(Thread.holdsLock(PushDeliveryPermit.REALM_LOCK));
                suspendEntered.set(true);
                state.set(null);
                events.add("cancel");
            });
        });

        display.start();
        assertTrue(displayEntered.await(2, TimeUnit.SECONDS));
        suspend.start();
        assertTrue(suspendAttempting.await(2, TimeUnit.SECONDS));
        assertFalse(suspendEntered.get());
        releaseDisplay.countDown();
        display.join(2_000);
        suspend.join(2_000);

        assertEquals(List.of("forward", "display", "cancel"), events);
        assertFalse(display.isAlive());
        assertFalse(suspend.isAlive());
    }

    @Test
    public void activationThatEnteredFirstRejectsTheStaleGenerationBeforeForwarding() throws Exception {
        AtomicReference<PushDeliveryPermit.RealmState> state = new AtomicReference<>(
            PushDeliveryPermit.readPersistedState(INSTALLATION_A, "en", "zenflow_default_v4")
        );
        CountDownLatch activationEntered = new CountDownLatch(1);
        CountDownLatch releaseActivation = new CountDownLatch(1);
        AtomicBoolean forwarded = new AtomicBoolean(false);
        AtomicBoolean displayed = new AtomicBoolean(false);
        AtomicBoolean authorized = new AtomicBoolean(true);

        Thread activation = new Thread(() ->
            PushDeliveryPermit.withRealmLock(() -> {
                activationEntered.countDown();
                await(releaseActivation);
                state.set(PushDeliveryPermit.readPersistedState(
                    INSTALLATION_B,
                    "uk",
                    "zenflow_silent_v4"
                ));
            })
        );
        Thread staleDisplay = new Thread(() -> authorized.set(
            PushDeliveryPermit.executeAuthorized(
                state::get,
                message(INSTALLATION_A, "focus"),
                () -> {
                    forwarded.set(true);
                    displayed.set(true);
                }
            )
        ));

        activation.start();
        assertTrue(activationEntered.await(2, TimeUnit.SECONDS));
        staleDisplay.start();
        releaseActivation.countDown();
        activation.join(2_000);
        staleDisplay.join(2_000);

        assertFalse(authorized.get());
        assertFalse(forwarded.get());
        assertFalse(displayed.get());
        assertFalse(activation.isAlive());
        assertFalse(staleDisplay.isAlive());
    }

    private static Map<String, String> message(String installationId, String kind) {
        Map<String, String> data = new HashMap<>();
        data.put("zenflow_delivery_version", "1");
        data.put("zenflow_install_id", installationId);
        data.put("zenflow_notification_type", kind);
        return data;
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(2, TimeUnit.SECONDS)) {
                throw new AssertionError("Timed out waiting for test coordination");
            }
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new AssertionError("Interrupted while waiting for test coordination", error);
        }
    }
}

package com.zenflow.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.app.Instrumentation;
import android.app.UiAutomation;
import android.content.Context;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.MotionEvent;

import androidx.activity.BackEventCompat;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.OnBackPressedDispatcher;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import java.util.concurrent.atomic.AtomicInteger;

import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class AndroidBackDispatcherInstrumentedTest {

    @Test
    public void packageIdentityMatchesTheReleaseApplication() {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("com.zenflow.app", appContext.getPackageName());
    }

    @Test
    public void overlayAndNavigationConsumeWhileRootDelegatesToTheSystemFallback() {
        AndroidBackNavigationState state = new AndroidBackNavigationState();
        AtomicInteger consumed = new AtomicInteger();
        AtomicInteger rootFallback = new AtomicInteger();
        OnBackPressedDispatcher dispatcher = new OnBackPressedDispatcher(rootFallback::incrementAndGet);
        OnBackPressedCallback callback = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                consumed.incrementAndGet();
            }
        };
        dispatcher.addCallback(callback);

        // Overlay ownership.
        state.update(true);
        callback.setEnabled(state.canConsume());
        dispatcher.onBackPressed();

        // In-app navigation ownership uses the same committed native event.
        state.update(true);
        callback.setEnabled(state.canConsume());
        dispatcher.onBackPressed();

        // Orb root disables the callback so Android owns back-to-home.
        state.update(false);
        callback.setEnabled(state.canConsume());
        dispatcher.onBackPressed();

        assertEquals(2, consumed.get());
        assertEquals(1, rootFallback.get());
        assertFalse(callback.isEnabled());
    }

    @Test
    public void predictiveCancellationNeverCommitsAJavaScriptBackEvent() {
        AtomicInteger started = new AtomicInteger();
        AtomicInteger progressed = new AtomicInteger();
        AtomicInteger cancelled = new AtomicInteger();
        AtomicInteger committed = new AtomicInteger();
        OnBackPressedDispatcher dispatcher = new OnBackPressedDispatcher();
        OnBackPressedCallback callback = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackStarted(BackEventCompat event) {
                started.incrementAndGet();
            }

            @Override
            public void handleOnBackProgressed(BackEventCompat event) {
                progressed.incrementAndGet();
            }

            @Override
            public void handleOnBackCancelled() {
                cancelled.incrementAndGet();
            }

            @Override
            public void handleOnBackPressed() {
                committed.incrementAndGet();
            }
        };
        dispatcher.addCallback(callback);

        dispatcher.dispatchOnBackStarted(
                new BackEventCompat(0f, 0f, 0f, BackEventCompat.EDGE_LEFT));
        dispatcher.dispatchOnBackProgressed(
                new BackEventCompat(12f, 4f, 0.5f, BackEventCompat.EDGE_LEFT));
        dispatcher.dispatchOnBackCancelled();

        assertEquals(1, started.get());
        assertEquals(1, progressed.get());
        assertEquals(1, cancelled.get());
        assertEquals(0, committed.get());
        assertTrue(callback.isEnabled());
    }

    @Test
    public void platformInjectedEdgeGestureCancellationKeepsZenFlowForeground() {
        Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        UiAutomation automation = instrumentation.getUiAutomation();
        AtomicInteger activityIdentity = new AtomicInteger();

        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity ->
                    activityIdentity.set(System.identityHashCode(activity)));
            SystemClock.sleep(4_000L);

            long downTime = SystemClock.uptimeMillis();
            int y = instrumentation.getTargetContext()
                    .getResources()
                    .getDisplayMetrics()
                    .heightPixels / 2;

            // UiAutomation routes this touchscreen sequence through Android's real
            // predictive-back pipeline. ACTION_CANCEL is deliberate: it proves the
            // cancellation branch without claiming a human finger gesture.
            injectTouch(automation, downTime, MotionEvent.ACTION_DOWN, 1f, y);
            SystemClock.sleep(80L);
            injectTouch(automation, downTime, MotionEvent.ACTION_MOVE, 240f, y);
            SystemClock.sleep(80L);
            injectTouch(automation, downTime, MotionEvent.ACTION_MOVE, 48f, y);
            SystemClock.sleep(80L);
            injectTouch(automation, downTime, MotionEvent.ACTION_MOVE, 1f, y);
            SystemClock.sleep(80L);
            injectTouch(automation, downTime, MotionEvent.ACTION_CANCEL, 1f, y);
            SystemClock.sleep(1_000L);

            scenario.onActivity(activity ->
                    assertEquals(activityIdentity.get(), System.identityHashCode(activity)));
            assertNotNull(automation.getRootInActiveWindow());
            assertEquals(
                    "com.zenflow.app",
                    automation.getRootInActiveWindow().getPackageName().toString());
        }
    }

    private static void injectTouch(
            UiAutomation automation,
            long downTime,
            int action,
            float x,
            float y) {
        MotionEvent event = MotionEvent.obtain(
                downTime,
                SystemClock.uptimeMillis(),
                action,
                x,
                y,
                0);
        event.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        try {
            assertTrue(automation.injectInputEvent(event, true));
        } finally {
            event.recycle();
        }
    }

    @Test
    public void recreatedDispatcherStartsConservativeUntilTheWebShellHydrates() {
        AndroidBackNavigationState priorState = new AndroidBackNavigationState();
        priorState.update(false);

        AndroidBackNavigationState recreatedState = new AndroidBackNavigationState();
        OnBackPressedCallback recreatedCallback = new OnBackPressedCallback(
                recreatedState.canConsume()) {
            @Override
            public void handleOnBackPressed() {
                // The assertion covers callback ownership before hydration.
            }
        };

        assertFalse(priorState.canConsume());
        assertTrue(recreatedState.canConsume());
        assertTrue(recreatedCallback.isEnabled());
    }

    @Test
    public void mainActivityRecreationRestoresTheCapacitorWebView() {
        AtomicInteger firstActivityIdentity = new AtomicInteger();

        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                firstActivityIdentity.set(System.identityHashCode(activity));
                assertNotNull(activity.getBridge());
                assertNotNull(activity.getBridge().getWebView());
            });

            scenario.recreate();

            scenario.onActivity(activity -> {
                assertNotEquals(firstActivityIdentity.get(), System.identityHashCode(activity));
                assertNotNull(activity.getBridge());
                assertNotNull(activity.getBridge().getWebView());
            });
        }
    }
}

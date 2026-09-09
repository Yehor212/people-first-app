package com.zenflow.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import android.app.Instrumentation;
import android.content.Intent;

import androidx.activity.OnBackPressedCallback;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.runner.lifecycle.ActivityLifecycleCallback;
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry;
import androidx.test.runner.lifecycle.Stage;

import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;

import org.junit.After;
import org.junit.Before;
import org.junit.FixMethodOrder;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.MethodSorters;

import java.lang.reflect.Field;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

@RunWith(AndroidJUnit4.class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
public final class AndroidBackLifecycleTest {
    private static final Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
    private static final AtomicReference<MainActivity> launched = new AtomicReference<>();
    private static ActivityLifecycleCallback lifecycleCallback;
    private AndroidBackPlugin plugin;

    public static void launchActivity() throws InterruptedException {
        CountDownLatch resumed = new CountDownLatch(1);
        lifecycleCallback = (activity, stage) -> {
            if (activity instanceof MainActivity && stage == Stage.RESUMED) {
                launched.set((MainActivity) activity);
                resumed.countDown();
            }
        };
        instrumentation.runOnMainSync(() -> {
            ActivityLifecycleMonitorRegistry.getInstance().addLifecycleCallback(lifecycleCallback);
            instrumentation.getTargetContext().startActivity(
                new Intent(instrumentation.getTargetContext(), MainActivity.class)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            );
        });
        assertTrue("MainActivity must resume", resumed.await(20, TimeUnit.SECONDS));
    }

    public static void finishActivity() {
        instrumentation.runOnMainSync(() -> {
            ActivityLifecycleMonitorRegistry.getInstance().removeLifecycleCallback(lifecycleCallback);
            if (launched.get() != null) launched.get().finish();
        });
    }

    @Before
    public void createNativeOwner() throws InterruptedException {
        launchActivity();
        instrumentation.runOnMainSync(() -> {
            MainActivity activity = launched.get();
            assertTrue("Back proof requires a live attached Activity", !activity.isDestroyed() && !activity.isFinishing()
                && activity.getWindow().getDecorView().isAttachedToWindow());
            assertNotNull(activity.getBridge().getPlugin("AndroidBack"));
            // Use the production class and real Bridge/Android main queue. A
            // separate test-owned instance isolates live JavaScript state updates.
            plugin = new AndroidBackPlugin();
            plugin.setBridge(activity.getBridge());
            plugin.setPluginHandle(activity.getBridge().getPlugin("AndroidBack"));
            plugin.load();
        });
    }

    @After
    public void releaseNativeOwner() {
        instrumentation.runOnMainSync(() -> {
            if (plugin != null) plugin.handleOnDestroy();
        });
        finishActivity();
    }

    @Test
    public void activeOwnerAppliesQueuedStateAndDelegatesRoot() throws Exception {
        CapturedCall overlay = stateCall(true, true);
        plugin.setState(overlay);
        overlay.awaitReply();
        assertNull(overlay.rejection);
        assertNotNull(overlay.resolution);
        assertEquals(Boolean.TRUE, overlay.resolution.getBoolean("canConsume"));
        assertEquals(Boolean.TRUE, overlay.resolution.getBoolean("hasVisibleLayer"));
        assertEquals(1L, overlay.resolution.optLong("revision", -1));
        assertOwner(true, true, 1L, true);

        CapturedCall root = stateCall(false, false);
        plugin.setState(root);
        root.awaitReply();
        assertNull(root.rejection);
        assertNotNull(root.resolution);
        assertEquals(Boolean.FALSE, root.resolution.getBoolean("canConsume"));
        assertEquals(Boolean.FALSE, root.resolution.getBoolean("hasVisibleLayer"));
        assertEquals(2L, root.resolution.optLong("revision", -1));
        assertOwner(false, false, 2L, false);
    }

    @Test
    public void invalidStateDoesNotAdvanceOwnership() throws InterruptedException {
        JSObject missingLayer = new JSObject();
        missingLayer.put("canConsume", true);
        CapturedCall call = new CapturedCall(missingLayer);
        plugin.setState(call);
        call.awaitReply();
        assertEquals("INVALID_BACK_STATE", call.rejection);
        assertNull(call.resolution);
        assertOwner(false, false, 0L, false);
    }

    @Test
    public void postDestroyStateIsRejectedWithoutRevivingOwner() throws InterruptedException {
        instrumentation.runOnMainSync(() -> plugin.handleOnDestroy());
        CapturedCall call = stateCall(true, true);
        plugin.setState(call);
        call.awaitReply();
        assertEquals("INVALID_BACK_STATE", call.rejection);
        assertNull(call.resolution);
        assertOwner(false, false, 0L, null);
    }

    @Test
    public void queuedStateAfterDestroyIsRejectedWithoutAdvancingOwnership() throws InterruptedException {
        CapturedCall call = stateCall(true, true);
        instrumentation.runOnMainSync(() -> {
            // Bridge.executeOnMainThread posts even from the main thread. This
            // deterministically destroys the owner before its queued update runs.
            plugin.setState(call);
            plugin.handleOnDestroy();
        });
        call.awaitReply();
        assertEquals("INVALID_BACK_STATE", call.rejection);
        assertNull(call.resolution);
        assertOwner(false, false, 0L, null);
    }

    private void assertOwner(boolean canConsume, boolean hasVisibleLayer, long revision, Boolean enabled) {
        instrumentation.runOnMainSync(() -> {
            try {
                Field stateField = AndroidBackPlugin.class.getDeclaredField("navigationState");
                stateField.setAccessible(true);
                AndroidBackNavigationState state = (AndroidBackNavigationState) stateField.get(plugin);
                assertNotNull(state);
                assertEquals(canConsume, state.canConsume());
                assertEquals(hasVisibleLayer, state.hasVisibleLayer());
                assertEquals(revision, state.revision());
                Field callbackField = AndroidBackPlugin.class.getDeclaredField("backCallback");
                callbackField.setAccessible(true);
                OnBackPressedCallback callback = (OnBackPressedCallback) callbackField.get(plugin);
                if (enabled == null) {
                    assertNull("Destroyed owner must not regain a callback", callback);
                } else {
                    assertNotNull(callback);
                    assertEquals(enabled.booleanValue(), callback.isEnabled());
                }
            } catch (ReflectiveOperationException failure) {
                throw new AssertionError("Cannot inspect the native ownership result", failure);
            }
        });
    }

    private static CapturedCall stateCall(boolean canConsume, boolean hasVisibleLayer) {
        JSObject data = new JSObject();
        data.put("canConsume", canConsume);
        data.put("hasVisibleLayer", hasVisibleLayer);
        return new CapturedCall(data);
    }

    private static final class CapturedCall extends PluginCall {
        private final CountDownLatch replied = new CountDownLatch(1);
        private final AtomicInteger replyCount = new AtomicInteger();
        private volatile JSObject resolution;
        private volatile String rejection;

        private CapturedCall(JSObject data) {
            super(null, "AndroidBack", "native-lifecycle-regression", "setState", data);
        }

        @Override
        public void resolve(JSObject data) {
            resolution = data;
            replyCount.incrementAndGet();
            replied.countDown();
        }

        @Override
        public void reject(String message) {
            rejection = message;
            replyCount.incrementAndGet();
            replied.countDown();
        }

        private void awaitReply() throws InterruptedException {
            assertTrue("The native call must settle", replied.await(5, TimeUnit.SECONDS));
            assertEquals("A call must have exactly one native outcome", 1, replyCount.get());
            assertFalse("Resolution and rejection are mutually exclusive", resolution != null && rejection != null);
        }
    }
}

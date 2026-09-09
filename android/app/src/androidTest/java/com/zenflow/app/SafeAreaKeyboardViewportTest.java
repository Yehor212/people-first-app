package com.zenflow.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import android.app.Instrumentation;
import android.content.Intent;
import android.os.SystemClock;
import android.view.View;
import android.view.WindowManager;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.runner.lifecycle.ActivityLifecycleCallback;
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry;
import androidx.test.runner.lifecycle.Stage;

import com.getcapacitor.JSObject;
import com.getcapacitor.Bridge;
import com.getcapacitor.PluginCall;
import com.getcapacitor.WebViewListener;
import com.getcapacitor.community.safearea.SafeAreaPlugin;

import org.junit.After;
import org.junit.Before;
import org.junit.FixMethodOrder;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.MethodSorters;
import org.json.JSONObject;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/** Real installed SafeArea owner; no replacement WebView or inset listener. */
@RunWith(AndroidJUnit4.class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
public final class SafeAreaKeyboardViewportTest {
    private static final Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
    private static final AtomicReference<MainActivity> launched = new AtomicReference<>();
    private static ActivityLifecycleCallback lifecycle;
    private final List<String> leases = new ArrayList<>();
    private SafeAreaPlugin plugin;
    private int originalMode;

    public static void launchActivity() throws InterruptedException {
        CountDownLatch resumed = new CountDownLatch(1);
        lifecycle = (activity, stage) -> {
            if (activity instanceof MainActivity && stage == Stage.RESUMED) {
                launched.set((MainActivity) activity);
                resumed.countDown();
            }
        };
        instrumentation.runOnMainSync(() -> {
            ActivityLifecycleMonitorRegistry.getInstance().addLifecycleCallback(lifecycle);
            instrumentation.getTargetContext().startActivity(
                new Intent(instrumentation.getTargetContext(), MainActivity.class)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            );
        });
        assertTrue("MainActivity must resume", resumed.await(20, TimeUnit.SECONDS));
        long deadline = SystemClock.uptimeMillis() + 20000;
        boolean ready;
        do {
            ready = "true".equals(evaluate("location.origin === 'https://localhost' && document.readyState === 'complete'"));
            if (!ready) SystemClock.sleep(25);
        } while (!ready && SystemClock.uptimeMillis() < deadline);
        assertTrue("The actual local document must finish loading", ready);
    }

    public static void finishActivity() {
        instrumentation.runOnMainSync(() -> {
            ActivityLifecycleMonitorRegistry.getInstance().removeLifecycleCallback(lifecycle);
            if (launched.get() != null) launched.get().finish();
        });
    }

    @Before
    public void getInstalledOwner() throws InterruptedException {
        // AndroidJUnitRunner finishes activities at testStarted, after BeforeClass.
        // Each case must launch here, not reuse an already-destroyed class fixture.
        launchActivity();
        instrumentation.runOnMainSync(() -> {
            assertTrue("Lease proof requires a live attached Activity", !launched.get().isDestroyed() && !launched.get().isFinishing()
                && launched.get().getWindow().getDecorView().isAttachedToWindow());
            assertNotNull(launched.get().getBridge().getPlugin("SafeArea"));
            plugin = (SafeAreaPlugin) launched.get().getBridge().getPlugin("SafeArea").getInstance();
            originalMode = launched.get().getWindow().getAttributes().softInputMode;
        });
    }

    @After
    public void restoreLeaseAndMode() throws Exception {
        try {
            for (String owner : leases) invoke("releaseKeyboardViewport", data("owner", owner)).awaitReply();
            instrumentation.runOnMainSync(() -> {
                launched.get().getWindow().setSoftInputMode(originalMode);
                ViewCompat.requestApplyInsets(launched.get().getWindow().getDecorView());
            });
        } finally {
            finishActivity();
        }
    }

    @Test
    public void aDockedImeKeepsNativeBarsAndDoesNotResizeOrForwardOverlap() throws Exception {
        acquire();
        for (int version : new int[] {133, 140, 143, 144}) {
            for (boolean cover : new boolean[] {false, true}) {
                assertInsets(version, cover, Insets.of(0, 136, 0, 63), true, 883);
            }
        }
        assertEquals(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING, mode() & WindowManager.LayoutParams.SOFT_INPUT_MASK_ADJUST);
    }

    @Test
    public void bFloatingHiddenAndSideInsetsKeepSafeAreaWithoutFalseReservation() throws Exception {
        acquire();
        assertInsets(133, true, Insets.of(0, 136, 0, 63), true, 0);
        assertInsets(144, true, Insets.of(125, 0, 63, 0), false, 800);
    }

    @Test
    public void cStaleReleaseCannotClearReplacementAndExactSoftInputModeReturns() throws Exception {
        int saved = WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE;
        instrumentation.runOnMainSync(() -> launched.get().getWindow().setSoftInputMode(saved));
        String first = acquire();
        String second = acquire();
        assertFalse("A replacement must have a distinct native owner", first.equals(second));
        CapturedCall stale = invoke("releaseKeyboardViewport", data("owner", first));
        stale.awaitReply();
        assertNull(stale.rejection);
        assertEquals(Boolean.FALSE, stale.resolution.getBoolean("released"));
        assertEquals(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN, mode() & WindowManager.LayoutParams.SOFT_INPUT_MASK_STATE);
        assertEquals(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING, mode() & WindowManager.LayoutParams.SOFT_INPUT_MASK_ADJUST);
        CapturedCall current = invoke("releaseKeyboardViewport", data("owner", second));
        current.awaitReply();
        assertEquals(Boolean.TRUE, current.resolution.getBoolean("released"));
        assertEquals(saved, mode());
        assertEquals("true", evaluate("!document.documentElement.hasAttribute('data-journal-keyboard-viewport') && !document.documentElement.style.getPropertyValue('--zenflow-ime-overlap')"));
    }

    @Test
    public void dDocumentStartReleasesLeaseAndInvalidatesAlreadyQueuedAcquire() throws Exception {
        acquire();
        AtomicReference<CapturedCall> queued = new AtomicReference<>();
        instrumentation.runOnMainSync(() -> {
            queued.set(invoke("acquireKeyboardViewport", new JSObject()));
            for (WebViewListener listener : webViewListeners()) {
                listener.onPageStarted(launched.get().getBridge().getWebView());
            }
        });
        queued.get().awaitReply();
        assertEquals("KEYBOARD_VIEWPORT_UNAVAILABLE", queued.get().rejection);
        assertEquals(originalMode, mode());
    }

    @Test
    public void eSubresourceFailureDoesNotReleaseAHealthyEditor() throws Exception {
        acquire();
        instrumentation.runOnMainSync(() -> {
            for (WebViewListener listener : webViewListeners()) {
                listener.onReceivedError(launched.get().getBridge().getWebView());
                listener.onReceivedHttpError(launched.get().getBridge().getWebView());
            }
        });
        assertEquals(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING, mode() & WindowManager.LayoutParams.SOFT_INPUT_MASK_ADJUST);
    }

    @Test
    public void zDestroyedOwnerRestoresModeAndRejectsQueuedAcquire() throws Exception {
        acquire();
        AtomicReference<CapturedCall> queued = new AtomicReference<>();
        instrumentation.runOnMainSync(() -> {
            queued.set(invoke("acquireKeyboardViewport", new JSObject()));
            try {
                Method destroy = SafeAreaPlugin.class.getDeclaredMethod("handleOnDestroy");
                destroy.setAccessible(true);
                destroy.invoke(plugin);
            } catch (ReflectiveOperationException failure) {
                throw new AssertionError("The leased owner must clean up on destruction", failure);
            }
        });
        queued.get().awaitReply();
        assertEquals("KEYBOARD_VIEWPORT_UNAVAILABLE", queued.get().rejection);
        assertEquals(originalMode, mode());
    }

    private String acquire() throws Exception {
        CapturedCall call = invoke("acquireKeyboardViewport", new JSObject());
        call.awaitReply();
        Field destroyed = SafeAreaPlugin.class.getDeclaredField("keyboardViewportDestroyed");
        destroyed.setAccessible(true);
        assertNull("activityDestroyed=" + launched.get().isDestroyed() + ", activityFinishing=" + launched.get().isFinishing()
            + ", ownerDestroyed=" + destroyed.getBoolean(plugin), call.rejection);
        assertNotNull(call.resolution);
        String owner = call.resolution.getString("owner");
        assertNotNull("Acquisition must return a native lease identity", owner);
        assertTrue(owner.matches("[1-9][0-9]*"));
        leases.add(owner);
        return owner;
    }

    private CapturedCall invoke(String method, JSObject data) {
        CapturedCall call = new CapturedCall(method, data);
        try {
            SafeAreaPlugin.class.getMethod(method, PluginCall.class).invoke(plugin, call);
        } catch (ReflectiveOperationException failure) {
            throw new AssertionError("SafeArea must expose the scoped " + method + " API", failure);
        }
        return call;
    }

    private void assertInsets(int version, boolean cover, Insets bars, boolean visible, int imeBottom) throws Exception {
        AtomicReference<String> css = new AtomicReference<>();
        CountDownLatch evaluated = new CountDownLatch(1);
        instrumentation.runOnMainSync(() -> {
            View decor = launched.get().getWindow().getDecorView();
            try {
                Field versionField = SafeAreaPlugin.class.getDeclaredField("webViewMajorVersion");
                Field coverField = SafeAreaPlugin.class.getDeclaredField("hasMetaViewportCover");
                versionField.setAccessible(true);
                coverField.setAccessible(true);
                int priorVersion = versionField.getInt(plugin);
                boolean priorCover = coverField.getBoolean(plugin);
                try {
                    versionField.setInt(plugin, version);
                    coverField.setBoolean(plugin, cover);
                    WindowInsetsCompat input = new WindowInsetsCompat.Builder()
                        .setInsets(WindowInsetsCompat.Type.systemBars(), bars)
                        .setVisible(WindowInsetsCompat.Type.systemBars(), true)
                        .setInsets(WindowInsetsCompat.Type.displayCutout(), Insets.NONE)
                        .setInsets(WindowInsetsCompat.Type.ime(), Insets.of(0, 0, 0, imeBottom))
                        .setVisible(WindowInsetsCompat.Type.ime(), visible).build();
                    WindowInsetsCompat forwarded = ViewCompat.dispatchApplyWindowInsets(decor, input);
                    assertEquals(bars, Insets.of(decor.getPaddingLeft(), decor.getPaddingTop(), decor.getPaddingRight(), decor.getPaddingBottom()));
                    assertEquals(Insets.NONE, forwarded.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime()));
                    // Queue the read immediately after this inset's CSS write,
                    // before a later real-system inset replaces the test input.
                    launched.get().getBridge().getWebView().evaluateJavascript(
                        "({overlap:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--zenflow-ime-overlap')),dpr:devicePixelRatio})",
                        value -> { css.set(value); evaluated.countDown(); }
                    );
                } finally {
                    versionField.setInt(plugin, priorVersion);
                    coverField.setBoolean(plugin, priorCover);
                }
            } catch (ReflectiveOperationException failure) {
                throw new AssertionError("Cannot inspect the installed compatibility branch", failure);
            }
        });
        assertTrue("The same inset's CSS delivery must complete", evaluated.await(5, TimeUnit.SECONDS));
        JSONObject observed = new JSONObject(css.get());
        double overlap = visible ? Math.max(0, imeBottom - bars.bottom) : 0;
        assertEquals("Measured native overlap must reach CSS exactly once: " + observed,
            overlap / observed.getDouble("dpr"), observed.getDouble("overlap"), 0.01);
    }

    private int mode() {
        AtomicInteger value = new AtomicInteger();
        instrumentation.runOnMainSync(() -> value.set(launched.get().getWindow().getAttributes().softInputMode));
        return value.get();
    }

    private static List<WebViewListener> webViewListeners() {
        try {
            Method accessor = Bridge.class.getDeclaredMethod("getWebViewListeners");
            accessor.setAccessible(true);
            Object result = accessor.invoke(launched.get().getBridge());
            assertTrue(result instanceof List<?>);
            List<WebViewListener> listeners = new ArrayList<>();
            for (Object item : (List<?>) result) {
                assertTrue(item instanceof WebViewListener);
                listeners.add((WebViewListener) item);
            }
            return listeners;
        } catch (ReflectiveOperationException failure) {
            throw new AssertionError("Cannot invoke installed page lifecycle listeners", failure);
        }
    }

    private static JSObject data(String key, String value) {
        JSObject result = new JSObject();
        result.put(key, value);
        return result;
    }

    private static String evaluate(String source) throws InterruptedException {
        AtomicReference<String> result = new AtomicReference<>();
        CountDownLatch complete = new CountDownLatch(1);
        instrumentation.runOnMainSync(() -> launched.get().getBridge().getWebView().evaluateJavascript(source, value -> {
            result.set(value);
            complete.countDown();
        }));
        assertTrue("Numeric/local-document evaluation must complete", complete.await(5, TimeUnit.SECONDS));
        return result.get();
    }

    private static final class CapturedCall extends PluginCall {
        private final CountDownLatch replied = new CountDownLatch(1);
        private final AtomicInteger replies = new AtomicInteger();
        private volatile JSObject resolution;
        private volatile String rejection;

        CapturedCall(String method, JSObject data) {
            super(null, "SafeArea", "keyboard-viewport-regression", method, data);
        }

        @Override public void resolve(JSObject data) {
            resolution = data;
            replies.incrementAndGet();
            replied.countDown();
        }

        @Override public void reject(String message) {
            rejection = message;
            replies.incrementAndGet();
            replied.countDown();
        }

        void awaitReply() throws InterruptedException {
            assertTrue("Native lease call must settle", replied.await(5, TimeUnit.SECONDS));
            assertEquals("Each call has exactly one outcome", 1, replies.get());
            assertFalse(resolution != null && rejection != null);
        }
    }
}

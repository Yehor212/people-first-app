package com.zenflow.app;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNotSame;
import static org.junit.Assert.assertTrue;

import android.os.Process;
import android.os.SystemClock;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import com.getcapacitor.PluginHandle;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.lang.reflect.Field;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BooleanSupplier;

@RunWith(AndroidJUnit4.class)
public final class AndroidBackActivityRecreationTest {

    private static final long WAIT_TIMEOUT_MS = 20_000;

    @Test
    public void activityRecreationDropsStaleVisibleLayerOwnershipInTheSameProcess()
        throws Exception {
        AtomicReference<MainActivity> firstActivity = new AtomicReference<>();
        AtomicReference<WebView> firstWebView = new AtomicReference<>();
        AtomicReference<AndroidBackPlugin> firstPlugin = new AtomicReference<>();
        AtomicReference<AndroidBackNavigationState> firstState = new AtomicReference<>();
        int processId = Process.myPid();

        try (ActivityScenario<MainActivity> scenario =
            ActivityScenario.launch(MainActivity.class)) {
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED);
            scenario.onActivity(activity -> {
                firstActivity.set(activity);
                firstWebView.set(activity.getBridge().getWebView());
                firstPlugin.set(backPlugin(activity));
                firstState.set(backState(firstPlugin.get()));
            });

            waitForJavaScript(
                firstWebView.get(),
                "typeof window.Capacitor?.Plugins?.AndroidBack?.setState === 'function'",
                "true"
            );
            evaluateJavaScript(
                firstWebView.get(),
                "(() => {" +
                    "window.__t182BackStateResult = 'pending';" +
                    "window.Capacitor.Plugins.AndroidBack.setState({" +
                        "canConsume:true,hasVisibleLayer:true" +
                    "}).then(" +
                        "value => { window.__t182BackStateResult = JSON.stringify(value); }," +
                        "error => { window.__t182BackStateResult = 'error:' + String(error); }" +
                    ");" +
                    "return 'scheduled';" +
                "})()"
            );
            waitForJavaScript(
                firstWebView.get(),
                "typeof window.__t182BackStateResult === 'string' && " +
                    "window.__t182BackStateResult.includes('\\\"hasVisibleLayer\\\":true')",
                "true"
            );
            waitUntil(
                () ->
                    firstState.get().canConsume() &&
                    firstState.get().hasVisibleLayer() &&
                    backCallback(firstPlugin.get()).isEnabled(),
                "the pre-recreation plugin never owned the transient Back layer"
            );

            AtomicReference<MainActivity> recreatedActivity = new AtomicReference<>();
            AtomicReference<WebView> recreatedWebView = new AtomicReference<>();
            AtomicReference<AndroidBackPlugin> recreatedPlugin = new AtomicReference<>();
            AtomicReference<AndroidBackNavigationState> recreatedState =
                new AtomicReference<>();

            scenario.recreate();
            scenario.onActivity(activity -> {
                recreatedActivity.set(activity);
                recreatedWebView.set(activity.getBridge().getWebView());
                recreatedPlugin.set(backPlugin(activity));
                recreatedState.set(backState(recreatedPlugin.get()));
            });

            assertNotSame(firstActivity.get(), recreatedActivity.get());
            assertNotSame(firstWebView.get(), recreatedWebView.get());
            assertNotSame(firstPlugin.get(), recreatedPlugin.get());
            assertNotSame(firstState.get(), recreatedState.get());
            assertTrue(processId == Process.myPid());

            waitForJavaScript(
                recreatedWebView.get(),
                "typeof window.Capacitor?.Plugins?.AndroidBack?.setState === 'function'",
                "true"
            );
            waitForJavaScript(
                recreatedWebView.get(),
                "typeof window.__t182BackStateResult === 'undefined'",
                "true"
            );
            waitUntil(
                () ->
                    recreatedState.get().revision() >= 1 &&
                    !recreatedState.get().canConsume() &&
                    !recreatedState.get().hasVisibleLayer() &&
                    !backCallback(recreatedPlugin.get()).isEnabled(),
                "recreated Activity did not hydrate to clean-root Back delegation"
            );

            assertFalse(recreatedState.get().canConsume());
            assertFalse(recreatedState.get().hasVisibleLayer());
            assertFalse(backCallback(recreatedPlugin.get()).isEnabled());

            System.out.println(
                "T182_ACTIVITY_RECREATION " +
                    "sameProcess=true " +
                    "newActivity=true " +
                    "newWebView=true " +
                    "newPlugin=true " +
                    "newNavigationState=true " +
                    "staleVisibleLayer=false " +
                    "hydratedRootDelegates=true"
            );
        }
    }

    private static AndroidBackPlugin backPlugin(MainActivity activity) {
        assertNotNull(activity);
        assertNotNull(activity.getBridge());
        PluginHandle handle = activity.getBridge().getPlugin("AndroidBack");
        assertNotNull(handle);
        assertTrue(handle.getInstance() instanceof AndroidBackPlugin);
        return (AndroidBackPlugin) handle.getInstance();
    }

    private static AndroidBackNavigationState backState(AndroidBackPlugin plugin) {
        return (AndroidBackNavigationState) privateField(
            AndroidBackPlugin.class,
            plugin,
            "navigationState"
        );
    }

    private static OnBackPressedCallback backCallback(AndroidBackPlugin plugin) {
        return (OnBackPressedCallback) privateField(
            AndroidBackPlugin.class,
            plugin,
            "backCallback"
        );
    }

    private static Object privateField(
        Class<?> owner,
        Object instance,
        String fieldName
    ) {
        try {
            Field field = owner.getDeclaredField(fieldName);
            field.setAccessible(true);
            Object value = field.get(instance);
            assertNotNull(value);
            return value;
        } catch (ReflectiveOperationException error) {
            throw new AssertionError("Unable to inspect " + fieldName, error);
        }
    }

    private static String evaluateJavaScript(WebView webView, String expression)
        throws InterruptedException {
        assertNotNull(webView);
        AtomicReference<String> result = new AtomicReference<>();
        CountDownLatch callback = new CountDownLatch(1);
        InstrumentationRegistry.getInstrumentation().runOnMainSync(
            () ->
                webView.evaluateJavascript(
                    expression,
                    value -> {
                        result.set(value);
                        callback.countDown();
                    }
                )
        );
        assertTrue(
            "WebView JavaScript callback timed out for: " + expression,
            callback.await(WAIT_TIMEOUT_MS, TimeUnit.MILLISECONDS)
        );
        return result.get();
    }

    private static void waitForJavaScript(
        WebView webView,
        String expression,
        String expected
    ) throws InterruptedException {
        long deadline = SystemClock.elapsedRealtime() + WAIT_TIMEOUT_MS;
        String actual = null;
        while (SystemClock.elapsedRealtime() < deadline) {
            actual = evaluateJavaScript(webView, expression);
            if (expected.equals(actual)) return;
            SystemClock.sleep(100);
        }
        throw new AssertionError(
            "Timed out waiting for JavaScript expression: " +
                expression +
                "; last result=" +
                actual
        );
    }

    private static void waitUntil(BooleanSupplier condition, String failure) {
        long deadline = SystemClock.elapsedRealtime() + WAIT_TIMEOUT_MS;
        while (SystemClock.elapsedRealtime() < deadline) {
            if (condition.getAsBoolean()) return;
            SystemClock.sleep(100);
        }
        throw new AssertionError(failure);
    }
}

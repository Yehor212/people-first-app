package com.zenflow.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;
import static org.junit.Assume.assumeTrue;

import android.app.Instrumentation;
import android.app.LocaleManager;
import android.os.Build;
import android.os.LocaleList;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

@RunWith(AndroidJUnit4.class)
public final class LocaleContinuityTest {
    @Test
    public void directionChangePreservesActivityWebViewAndCurrentDocument() throws Exception {
        assumeTrue(Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU);
        Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        LocaleManager manager = instrumentation.getTargetContext().getSystemService(LocaleManager.class);
        assertNotNull(manager);
        LocaleList originalLocales = manager.getApplicationLocales();

        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            AtomicReference<MainActivity> originalActivity = new AtomicReference<>();
            AtomicReference<WebView> originalWebView = new AtomicReference<>();
            scenario.onActivity(activity -> {
                originalActivity.set(activity);
                originalWebView.set(findWebView(activity.getWindow().getDecorView()));
            });
            assertNotNull(originalWebView.get());
            long documentDeadline = SystemClock.elapsedRealtime() + 15_000;
            boolean documentReady = false;
            while (SystemClock.elapsedRealtime() < documentDeadline) {
                if ("true".equals(evaluate(instrumentation, originalWebView.get(),
                    "document.readyState === 'complete' && !!document.getElementById('root')?.firstElementChild"))) {
                    documentReady = true;
                    break;
                }
                SystemClock.sleep(100);
            }
            assertTrue("Initial application document must finish loading", documentReady);
            // A document marker is test-only state, never a user record or a saved draft.
            String originalDocument = evaluate(instrumentation, originalWebView.get(),
                "window.__zenflowLocaleContinuity = 'retained'; location.href");
            int originalDirection = originalActivity.get().getResources().getConfiguration().getLayoutDirection();
            int targetDirection = originalDirection == View.LAYOUT_DIRECTION_RTL
                ? View.LAYOUT_DIRECTION_LTR : View.LAYOUT_DIRECTION_RTL;
            String targetLanguage = targetDirection == View.LAYOUT_DIRECTION_RTL ? "ar" : "en";

            instrumentation.runOnMainSync(() -> manager.setApplicationLocales(LocaleList.forLanguageTags(targetLanguage)));

            long deadline = SystemClock.elapsedRealtime() + 10_000;
            boolean delivered = false;
            while (SystemClock.elapsedRealtime() < deadline) {
                AtomicReference<Boolean> configurationMatches = new AtomicReference<>(false);
                scenario.onActivity(activity -> {
                    assertSame("Language direction must not replace the current Activity", originalActivity.get(), activity);
                    assertSame("Language direction must not replace the current WebView", originalWebView.get(),
                        findWebView(activity.getWindow().getDecorView()));
                    configurationMatches.set(activity.getResources().getConfiguration().getLayoutDirection() == targetDirection);
                });
                if (configurationMatches.get()) {
                    delivered = true;
                    break;
                }
                SystemClock.sleep(50);
            }
            assertTrue("Android must deliver the requested direction change", delivered);
            assertEquals("The current document must survive the native configuration change", "\"retained\"",
                evaluate(instrumentation, originalWebView.get(), "window.__zenflowLocaleContinuity"));
            assertEquals("The current route must remain open", originalDocument,
                evaluate(instrumentation, originalWebView.get(), "location.href"));
            evaluate(instrumentation, originalWebView.get(), "delete window.__zenflowLocaleContinuity");
        } finally {
            instrumentation.runOnMainSync(() -> manager.setApplicationLocales(originalLocales));
        }
    }

    private static WebView findWebView(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int index = 0; index < group.getChildCount(); index++) {
                WebView result = findWebView(group.getChildAt(index));
                if (result != null) return result;
            }
        }
        return null;
    }

    private static String evaluate(Instrumentation instrumentation, WebView webView, String expression)
        throws InterruptedException {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        instrumentation.runOnMainSync(() -> webView.evaluateJavascript(expression, value -> {
            result.set(value);
            done.countDown();
        }));
        assertTrue("Live WebView must answer the continuity check", done.await(10, TimeUnit.SECONDS));
        return result.get();
    }
}

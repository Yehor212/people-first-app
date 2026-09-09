package com.zenflow.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.app.Instrumentation;
import android.content.Intent;
import android.os.SystemClock;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.runner.lifecycle.ActivityLifecycleCallback;
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry;
import androidx.test.runner.lifecycle.Stage;

import com.getcapacitor.PluginHandle;
import com.getcapacitor.community.safearea.SafeAreaPlugin;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.lang.reflect.Field;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.atomic.AtomicBoolean;

@RunWith(AndroidJUnit4.class)
public final class SafeAreaKeyboardInsetsTest {
    private static final Insets PORTRAIT_BARS = Insets.of(0, 136, 0, 63);
    private static final int[] WEBVIEW_VERSIONS = {133, 140, 143, 144};

    private static final Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
    private static final AtomicReference<MainActivity> launched = new AtomicReference<>();
    private static ActivityLifecycleCallback callback;

    @Before
    public void launchActivity() throws InterruptedException {
        CountDownLatch resumed = new CountDownLatch(1);
        callback = (activity, stage) -> {
            if (activity instanceof MainActivity && stage == Stage.RESUMED) {
                launched.set((MainActivity) activity);
                resumed.countDown();
            }
        };
        instrumentation.runOnMainSync(() -> {
            ActivityLifecycleMonitorRegistry.getInstance().addLifecycleCallback(callback);
            instrumentation.getTargetContext().startActivity(
                new Intent(instrumentation.getTargetContext(), MainActivity.class)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            );
        });
        // The app's continuous WebView animations do not need to become idle.
        assertTrue("MainActivity must resume", resumed.await(20, TimeUnit.SECONDS));
        AtomicBoolean attached = new AtomicBoolean();
        long deadline = SystemClock.uptimeMillis() + 10000;
        do {
            instrumentation.runOnMainSync(() -> {
                MainActivity activity = launched.get();
                View decor = activity.getWindow().getDecorView();
                attached.set(!activity.isDestroyed() && !activity.isFinishing()
                    && decor.isAttachedToWindow() && decor.getWidth() > 0 && decor.getHeight() > 0);
            });
            if (!attached.get()) SystemClock.sleep(25);
        } while (!attached.get() && SystemClock.uptimeMillis() < deadline);
        assertTrue("Resume must produce a live measured window before inset assertions", attached.get());
    }

    @After
    public void finishActivity() {
        instrumentation.runOnMainSync(() -> {
            ActivityLifecycleMonitorRegistry.getInstance().removeLifecycleCallback(callback);
            if (launched.get() != null) launched.get().finish();
        });
    }

    @Test
    public void legacyFloatingImePreservesNavigationBarPadding() {
        assertInsets(133, true, true, 0, PORTRAIT_BARS, PORTRAIT_BARS, 0);
    }

    @Test
    public void webView140FloatingImePreservesBottomSafeArea() {
        assertInsets(140, true, true, 0, PORTRAIT_BARS, Insets.NONE, 63);
    }

    @Test
    public void webView143FloatingImePreservesBottomSafeArea() {
        assertInsets(143, true, true, 0, PORTRAIT_BARS, Insets.NONE, 63);
    }

    @Test
    public void webView144FloatingImeRetainsNativeSafeAreaHandling() {
        assertInsets(144, true, true, 0, PORTRAIT_BARS, Insets.NONE, 63);
    }

    @Test
    public void missingViewportCoverPreservesFloatingImePaddingAtEveryVersion() {
        for (int version : WEBVIEW_VERSIONS) {
            assertInsets(version, false, true, 0, PORTRAIT_BARS, PORTRAIT_BARS, 0);
        }
    }

    @Test
    public void dockedAndHiddenKeyboardKeepTheirExistingInsetOwnership() {
        for (int version : WEBVIEW_VERSIONS) {
            boolean passthrough = version >= 140;
            Insets dockedPadding = passthrough ? Insets.of(0, 0, 0, 800) : Insets.of(0, 136, 0, 800);
            int dockedBottom = version >= 144 ? 63 : 0;
            assertInsets(version, true, true, 800, PORTRAIT_BARS, dockedPadding, dockedBottom);
            assertInsets(version, true, false, 0, PORTRAIT_BARS, passthrough ? Insets.NONE : PORTRAIT_BARS, passthrough ? 63 : 0);
            assertInsets(version, false, true, 800, PORTRAIT_BARS, Insets.of(0, 136, 0, 800), 0);
            assertInsets(version, false, false, 0, PORTRAIT_BARS, PORTRAIT_BARS, 0);
        }
    }

    @Test
    public void floatingImePreservesLandscapeSideInsets() {
        Insets landscapeBars = Insets.of(125, 0, 63, 0);
        for (int version : WEBVIEW_VERSIONS) {
            assertInsets(version, true, true, 0, landscapeBars, version >= 140 ? Insets.NONE : landscapeBars, 0);
            assertInsets(version, false, true, 0, landscapeBars, landscapeBars, 0);
        }
    }

    private void assertInsets(
        int webViewVersion,
        boolean viewportCover,
        boolean imeVisible,
        int imeBottom,
        Insets systemBars,
        Insets expectedPadding,
        int expectedForwardedBottom
    ) {
        instrumentation.runOnMainSync(() -> {
            MainActivity activity = launched.get();
            assertTrue("Inset proof requires a live attached Activity", !activity.isDestroyed() && !activity.isFinishing()
                && activity.getWindow().getDecorView().isAttachedToWindow());
            PluginHandle handle = activity.getBridge().getPlugin("SafeArea");
            assertNotNull("The actual SafeArea plugin must be registered", handle);
            assertTrue("The plugin must be the installed native implementation", handle.getInstance() instanceof SafeAreaPlugin);
            SafeAreaPlugin plugin = (SafeAreaPlugin) handle.getInstance();
            View decor = activity.getWindow().getDecorView();
            Insets originalPadding = padding(decor);
            try {
                // These isolated compatibility inputs exercise the real listener. They
                // neither replace the WebView provider nor prove another provider's pixels.
                Field versionField = SafeAreaPlugin.class.getDeclaredField("webViewMajorVersion");
                Field coverField = SafeAreaPlugin.class.getDeclaredField("hasMetaViewportCover");
                versionField.setAccessible(true);
                coverField.setAccessible(true);
                int originalVersion = versionField.getInt(plugin);
                boolean originalCover = coverField.getBoolean(plugin);
                try {
                    versionField.setInt(plugin, webViewVersion);
                    coverField.setBoolean(plugin, viewportCover);
                    WindowInsetsCompat input = new WindowInsetsCompat.Builder()
                        .setInsets(WindowInsetsCompat.Type.systemBars(), systemBars)
                        .setVisible(WindowInsetsCompat.Type.systemBars(), true)
                        .setInsets(WindowInsetsCompat.Type.displayCutout(), Insets.NONE)
                        .setInsets(WindowInsetsCompat.Type.ime(), Insets.of(0, 0, 0, imeBottom))
                        .setVisible(WindowInsetsCompat.Type.ime(), imeVisible)
                        .build();
                    assertEquals("Fixture IME visibility must remain independent of height", imeVisible, input.isVisible(WindowInsetsCompat.Type.ime()));
                    assertEquals("Fixture must retain its measured overlap", imeBottom, input.getInsets(WindowInsetsCompat.Type.ime()).bottom);
                    WindowInsetsCompat forwarded = ViewCompat.dispatchApplyWindowInsets(decor, input);
                    String scenario = "WebView " + webViewVersion + ", cover=" + viewportCover
                        + ", imeVisible=" + imeVisible + ", imeBottom=" + imeBottom
                        + ", activityDestroyed=" + activity.isDestroyed() + ", activityFinishing=" + activity.isFinishing();
                    assertEquals(scenario + " native padding", expectedPadding, padding(decor));
                    Insets expectedForwarded = webViewVersion >= 140 && viewportCover
                        ? Insets.of(systemBars.left, systemBars.top, systemBars.right, expectedForwardedBottom)
                        : Insets.NONE;
                    assertEquals(
                        scenario + " forwarded system safe area",
                        expectedForwarded,
                        forwarded.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout())
                    );
                } finally {
                    versionField.setInt(plugin, originalVersion);
                    coverField.setBoolean(plugin, originalCover);
                }
            } catch (ReflectiveOperationException failure) {
                throw new AssertionError("The installed SafeArea compatibility fields changed", failure);
            } finally {
                decor.setPadding(originalPadding.left, originalPadding.top, originalPadding.right, originalPadding.bottom);
                ViewCompat.requestApplyInsets(decor);
            }
        });
    }

    private static Insets padding(View view) {
        return Insets.of(view.getPaddingLeft(), view.getPaddingTop(), view.getPaddingRight(), view.getPaddingBottom());
    }
}

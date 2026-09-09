package com.zenflow.app;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.Choreographer;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsAnimation;
import android.view.WindowManager;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.runner.lifecycle.ActivityLifecycleCallback;
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry;
import androidx.test.runner.lifecycle.Stage;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/** Temporary, opt-in diagnostic. Never packaged with the application. */
@RunWith(AndroidJUnit4.class)
public final class ImeAnimationDiagnosticTest {
    private static final String STOP = "com.zenflow.app.test.IME_DIAGNOSTIC_STOP";
    private static final String STYLE = "zenflow-ime-stable-surface-diagnostic";

    @Test
    public void observeActualKeyboardTransitions() throws InterruptedException {
        String mode = InstrumentationRegistry.getArguments().getString("imeMode");
        org.junit.Assume.assumeTrue("Explicit diagnostic mode required", "baseline".equals(mode) || "progress".equals(mode) || "fixed-surface".equals(mode) || "stable-root".equals(mode));
        Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        AtomicReference<Activity> activityRef = new AtomicReference<>();
        CountDownLatch resumed = new CountDownLatch(1);
        CountDownLatch stopped = new CountDownLatch(1);
        List<String> samples = new ArrayList<>();
        ActivityLifecycleCallback lifecycle = (activity, stage) -> {
            if (activity.getClass().getName().equals("com.zenflow.app.MainActivity") && stage == Stage.RESUMED) {
                activityRef.set(activity);
                resumed.countDown();
            }
        };
        Context context = instrumentation.getTargetContext();
        BroadcastReceiver stopReceiver = new BroadcastReceiver() {
            @Override public void onReceive(Context receiverContext, Intent intent) {
                if (STOP.equals(intent.getAction())) stopped.countDown();
            }
        };
        AtomicReference<Choreographer.FrameCallback> samplerRef = new AtomicReference<>();
        AtomicReference<WebView> fixedWebView = new AtomicReference<>();
        List<ViewGroup> unclippedGroups = new ArrayList<>();
        List<boolean[]> originalClips = new ArrayList<>();
        int[] originalHeight = new int[1];
        int[] originalSoftInputMode = new int[1];
        int[] originalPadding = new int[4];
        AtomicReference<WebView> stableRootWebView = new AtomicReference<>();
        try {
            instrumentation.runOnMainSync(() -> {
                ActivityLifecycleMonitorRegistry.getInstance().addLifecycleCallback(lifecycle);
                context.registerReceiver(stopReceiver, new IntentFilter(STOP), Context.RECEIVER_EXPORTED);
                context.startActivity(new Intent().setClassName(context, "com.zenflow.app.MainActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            });
            assertTrue("MainActivity must resume", resumed.await(20, TimeUnit.SECONDS));
            long measuredDeadline = SystemClock.uptimeMillis() + 10000;
            boolean[] measured = {false};
            do {
                instrumentation.runOnMainSync(() -> {
                    WebView webView = findWebView(activityRef.get().getWindow().getDecorView());
                    measured[0] = webView != null && webView.getHeight() > 0;
                });
                if (!measured[0]) SystemClock.sleep(25);
            } while (!measured[0] && SystemClock.uptimeMillis() < measuredDeadline);
            assertTrue("WebView must have real measured geometry before diagnostics", measured[0]);
            instrumentation.runOnMainSync(() -> {
                Activity activity = activityRef.get();
                View decor = activity.getWindow().getDecorView();
                WebView webView = findWebView(decor);
                assertNotNull("Real WebView must be mounted", webView);
                if ("stable-root".equals(mode)) {
                    originalSoftInputMode[0] = activity.getWindow().getAttributes().softInputMode;
                    originalPadding[0] = decor.getPaddingLeft();
                    originalPadding[1] = decor.getPaddingTop();
                    originalPadding[2] = decor.getPaddingRight();
                    originalPadding[3] = decor.getPaddingBottom();
                    stableRootWebView.set(webView);
                    activity.getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING);
                    // Replace the native owner only in this disposable test Activity.
                    // No animation callback, ancestor unclipping or surface recoloring.
                    ViewCompat.setOnApplyWindowInsetsListener(decor, (view, insets) -> {
                        int bars = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
                        Insets system = insets.getInsets(bars);
                        Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
                        int overlap = insets.isVisible(WindowInsetsCompat.Type.ime())
                            ? Math.max(0, ime.bottom - system.bottom) : 0;
                        view.setPadding(system.left, system.top, system.right, system.bottom);
                        updateStableRootCss(webView, overlap);
                        return new WindowInsetsCompat.Builder(insets)
                            .setInsets(bars, Insets.NONE)
                            .setInsets(WindowInsetsCompat.Type.ime(), Insets.NONE)
                            .build();
                    });
                }
                if ("fixed-surface".equals(mode)) {
                    originalHeight[0] = webView.getLayoutParams().height;
                    ViewGroup.LayoutParams params = webView.getLayoutParams();
                    params.height = webView.getHeight();
                    webView.setLayoutParams(params);
                    fixedWebView.set(webView);
                    for (android.view.ViewParent parent = webView.getParent(); parent instanceof ViewGroup; parent = parent.getParent()) {
                        ViewGroup group = (ViewGroup) parent;
                        unclippedGroups.add(group);
                        originalClips.add(new boolean[] {group.getClipChildren(), group.getClipToPadding()});
                        group.setClipChildren(false);
                        group.setClipToPadding(false);
                    }
                    // Isolated ownership probe only: native surface stays fixed;
                    // CSS receives the same unobscured height from real IME bounds.
                    decor.setWindowInsetsAnimationCallback(new WindowInsetsAnimation.Callback(WindowInsetsAnimation.Callback.DISPATCH_MODE_CONTINUE_ON_SUBTREE) {
                        private int previousHeight = -1;
                        @Override public WindowInsets onProgress(WindowInsets insets, List<WindowInsetsAnimation> animations) {
                            boolean ime = animations.stream().anyMatch(animation -> (animation.getTypeMask() & WindowInsets.Type.ime()) != 0);
                            if (ime) updateVisibleHeight(insets);
                            return insets;
                        }
                        @Override public void onEnd(WindowInsetsAnimation animation) {
                            if ((animation.getTypeMask() & WindowInsets.Type.ime()) != 0 && decor.getRootWindowInsets() != null) {
                                updateVisibleHeight(decor.getRootWindowInsets());
                            }
                        }
                        private void updateVisibleHeight(WindowInsets insets) {
                            int[] webPosition = new int[2];
                            int[] decorPosition = new int[2];
                            webView.getLocationOnScreen(webPosition);
                            decor.getLocationOnScreen(decorPosition);
                            int bottom = Math.max(insets.getInsets(WindowInsets.Type.ime()).bottom,
                                insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout()).bottom);
                            int available = Math.max(0, Math.min(webView.getHeight(), decorPosition[1] + decor.getHeight() - bottom - webPosition[1]));
                            if (available == previousHeight) return;
                            previousHeight = available;
                            webView.evaluateJavascript("(() => {if(location.origin !== 'https://localhost') return false;let style=document.getElementById('" + STYLE
                                + "');if(!style){style=document.createElement('style');style.id='" + STYLE + "';document.head.append(style);}"
                                + "style.textContent=':root[data-platform=android]{--app-viewport-height:'+(" + available
                                + "/devicePixelRatio)+'px !important;}';return true;})()", null);
                        }
                    });
                }
                if ("progress".equals(mode)) {
                    // Source inspection confirms this test-created activity has no
                    // production DecorView animation callback. It is finished below.
                    decor.setWindowInsetsAnimationCallback(new WindowInsetsAnimation.Callback(WindowInsetsAnimation.Callback.DISPATCH_MODE_CONTINUE_ON_SUBTREE) {
                        @Override public WindowInsets onProgress(WindowInsets insets, List<WindowInsetsAnimation> animations) {
                            boolean ime = animations.stream().anyMatch(animation -> (animation.getTypeMask() & WindowInsets.Type.ime()) != 0);
                            if (ime) decor.dispatchApplyWindowInsets(insets);
                            return insets;
                        }
                        @Override public void onEnd(WindowInsetsAnimation animation) {
                            if ((animation.getTypeMask() & WindowInsets.Type.ime()) != 0) decor.requestApplyInsets();
                        }
                    });
                }
                long start = SystemClock.elapsedRealtimeNanos();
                Choreographer.FrameCallback sampler = new Choreographer.FrameCallback() {
                    private String last = "";
                    @Override public void doFrame(long frameTimeNanos) {
                        WindowInsets insets = decor.getRootWindowInsets();
                        int[] position = new int[2];
                        webView.getLocationOnScreen(position);
                        String geometry = decor.getPaddingTop() + "," + decor.getPaddingBottom() + "," + position[1] + "," + webView.getHeight()
                            + "," + (insets == null ? -1 : insets.getInsets(WindowInsets.Type.ime()).bottom)
                            + "," + (insets != null && insets.isVisible(WindowInsets.Type.ime()));
                        if (!geometry.equals(last) && samples.size() < 2000) {
                            samples.add(((SystemClock.elapsedRealtimeNanos() - start) / 1_000_000.0) + "," + geometry);
                            last = geometry;
                        }
                        if (stopped.getCount() != 0) Choreographer.getInstance().postFrameCallback(this);
                    }
                };
                samplerRef.set(sampler);
                Choreographer.getInstance().postFrameCallback(sampler);
                // Use the repository's existing localhost-only benchmark entry.
                // This creates no journal records and is completed before recording.
                webView.loadUrl("https://localhost/orb?nav=v2&navLayout=phone&dev=true");
            });
            if (stableRootWebView.get() != null) {
                awaitLocalPage(instrumentation, stableRootWebView.get());
                instrumentation.runOnMainSync(() -> activityRef.get().getWindow().getDecorView().requestApplyInsets());
            }
            Bundle ready = new Bundle();
            ready.putString("imeDiagnosticReady", mode);
            ready.putLong("readyWallTimeMs", System.currentTimeMillis());
            instrumentation.sendStatus(2, ready);
            assertTrue("Diagnostic must receive its scoped stop broadcast within four minutes", stopped.await(240, TimeUnit.SECONDS));
        } finally {
            instrumentation.runOnMainSync(() -> {
                ActivityLifecycleMonitorRegistry.getInstance().removeLifecycleCallback(lifecycle);
                context.unregisterReceiver(stopReceiver);
                Choreographer.FrameCallback sampler = samplerRef.get();
                if (sampler != null) Choreographer.getInstance().removeFrameCallback(sampler);
                Activity activity = activityRef.get();
                if (activity != null) {
                    WebView stableWebView = stableRootWebView.get();
                    if (stableWebView != null) {
                        stableWebView.evaluateJavascript("document.getElementById('" + STYLE + "')?.remove();document.documentElement.style.removeProperty('--zenflow-test-ime-overlap')", null);
                        View decor = activity.getWindow().getDecorView();
                        ViewCompat.setOnApplyWindowInsetsListener(decor, null);
                        decor.setPadding(originalPadding[0], originalPadding[1], originalPadding[2], originalPadding[3]);
                        activity.getWindow().setSoftInputMode(originalSoftInputMode[0]);
                    }
                    if ("progress".equals(mode) || "fixed-surface".equals(mode)) {
                        activity.getWindow().getDecorView().setWindowInsetsAnimationCallback(null);
                        activity.getWindow().getDecorView().requestApplyInsets();
                    }
                    WebView webView = fixedWebView.get();
                    if (webView != null) {
                        webView.evaluateJavascript("document.getElementById('" + STYLE + "')?.remove()", null);
                        ViewGroup.LayoutParams params = webView.getLayoutParams();
                        params.height = originalHeight[0];
                        webView.setLayoutParams(params);
                        for (int i = 0; i < unclippedGroups.size(); i++) {
                            boolean[] clips = originalClips.get(i);
                            unclippedGroups.get(i).setClipChildren(clips[0]);
                            unclippedGroups.get(i).setClipToPadding(clips[1]);
                        }
                    }
                    activity.finish();
                }
            });
            Bundle result = new Bundle();
            result.putString("imeDiagnosticMode", mode);
            result.putString("columns", "elapsedMs,decorTop,decorBottom,webViewY,webViewHeight,rootImeBottom,rootImeVisible");
            result.putStringArrayList("geometrySamples", new ArrayList<>(samples));
            instrumentation.sendStatus(2, result);
        }
    }

    private static void updateStableRootCss(WebView webView, int overlap) {
        // The page and selectors are fixed; only a nonnegative native integer enters JS.
        // Keep the full background while its existing flex content gives room to IME.
        webView.evaluateJavascript("(() => {if(location.origin !== 'https://localhost') return false;"
            + "let style=document.getElementById('" + STYLE + "');"
            + "if(!style){style=document.createElement('style');style.id='" + STYLE + "';"
            + "style.textContent=':root[data-platform=android] [data-testid=journal-entry-editor][role=dialog]{"
            + "height:100dvh!important;max-height:100dvh!important;bottom:0!important;"
            + "padding-bottom:var(--zenflow-test-ime-overlap,0px)!important;}"
            + ":root[data-platform=android] [data-testid=journal-entry-editor][role=dialog] [data-testid=journal-editor-paper]{"
            + "min-height:calc((100dvh - var(--zenflow-test-ime-overlap,0px)) * .6)!important;}';document.head.append(style);}"
            + "document.documentElement.style.setProperty('--zenflow-test-ime-overlap',(" + overlap
            + "/devicePixelRatio)+'px');return true;})()", null);
    }

    private static void awaitLocalPage(Instrumentation instrumentation, WebView webView) throws InterruptedException {
        long deadline = SystemClock.uptimeMillis() + 20000;
        while (SystemClock.uptimeMillis() < deadline) {
            CountDownLatch answered = new CountDownLatch(1);
            boolean[] ready = {false};
            instrumentation.runOnMainSync(() -> webView.evaluateJavascript(
                "location.origin === 'https://localhost' && document.readyState === 'complete'",
                value -> { ready[0] = "true".equals(value); answered.countDown(); }));
            assertTrue("Local page readiness reply must arrive", answered.await(2, TimeUnit.SECONDS));
            if (ready[0]) return;
            SystemClock.sleep(50);
        }
        throw new AssertionError("Local app page must complete before stable-root diagnostic");
    }

    private static WebView findWebView(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                WebView found = findWebView(group.getChildAt(i));
                if (found != null) return found;
            }
        }
        return null;
    }
}

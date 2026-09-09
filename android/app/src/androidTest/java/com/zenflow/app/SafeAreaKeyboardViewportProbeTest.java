package com.zenflow.app;

import static org.junit.Assert.assertTrue;
import android.app.Instrumentation;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.SystemClock;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.runner.lifecycle.ActivityLifecycleCallback;
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry;
import androidx.test.runner.lifecycle.Stage;
import com.getcapacitor.community.safearea.SafeAreaPlugin;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.lang.reflect.Field;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/** Opt-in numeric lifecycle diagnosis, excluded from the app. */
@RunWith(AndroidJUnit4.class)
public final class SafeAreaKeyboardViewportProbeTest {
    @Test public void inspectOwnerAfterResume() throws Exception {
        org.junit.Assume.assumeTrue("Explicit diagnostic required", "true".equals(InstrumentationRegistry.getArguments().getString("viewportProbe")));
        Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        AtomicReference<MainActivity> launched = new AtomicReference<>();
        CountDownLatch resumed = new CountDownLatch(1);
        ActivityLifecycleCallback lifecycle = (activity, stage) -> {
            if (activity instanceof MainActivity && stage == Stage.RESUMED) {
                launched.set((MainActivity) activity);
                resumed.countDown();
            }
        };
        try {
            instrumentation.runOnMainSync(() -> {
                ActivityLifecycleMonitorRegistry.getInstance().addLifecycleCallback(lifecycle);
                instrumentation.getTargetContext().startActivity(new Intent(instrumentation.getTargetContext(), MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            });
            assertTrue(resumed.await(20, TimeUnit.SECONDS));
            for (int sample = 0; sample < 3; sample++) {
                instrumentation.runOnMainSync(() -> {
                    MainActivity activity = launched.get();
                    SafeAreaPlugin plugin = (SafeAreaPlugin) activity.getBridge().getPlugin("SafeArea").getInstance();
                    Bundle result = new Bundle();
                    result.putBoolean("activityDestroyed", activity.isDestroyed());
                    result.putBoolean("activityFinishing", activity.isFinishing());
                    for (String name : new String[] {"keyboardViewportDestroyed", "keyboardViewportOwner", "keyboardViewportPage"}) {
                        try {
                            Field field = SafeAreaPlugin.class.getDeclaredField(name);
                            field.setAccessible(true);
                            result.putString(name, String.valueOf(field.get(plugin)));
                        } catch (ReflectiveOperationException failure) { throw new AssertionError(failure); }
                    }
                    String actual = activity.getBridge().getWebView().getUrl();
                    result.putString("actualOrigin", actual == null ? "null" : Uri.parse(actual).getScheme() + "://" + Uri.parse(actual).getEncodedAuthority());
                    result.putString("localOrigin", activity.getBridge().getLocalUrl());
                    WindowInsetsCompat input = new WindowInsetsCompat.Builder()
                        .setInsets(WindowInsetsCompat.Type.systemBars(), Insets.of(0, 136, 0, 63))
                        .setVisible(WindowInsetsCompat.Type.systemBars(), true)
                        .setInsets(WindowInsetsCompat.Type.ime(), Insets.NONE)
                        .setVisible(WindowInsetsCompat.Type.ime(), false).build();
                    ViewCompat.dispatchApplyWindowInsets(activity.getWindow().getDecorView(), input);
                    result.putInt("dispatchedHiddenBottomPadding", activity.getWindow().getDecorView().getPaddingBottom());
                    instrumentation.sendStatus(2, result);
                });
                SystemClock.sleep(250);
            }
        } finally {
            instrumentation.runOnMainSync(() -> {
                ActivityLifecycleMonitorRegistry.getInstance().removeLifecycleCallback(lifecycle);
                if (launched.get() != null) launched.get().finish();
            });
        }
    }
}

package com.zenflow.app;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertTrue;

import android.app.Instrumentation;
import android.content.Intent;
import android.view.View;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.runner.lifecycle.ActivityLifecycleCallback;
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry;
import androidx.test.runner.lifecycle.Stage;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

@RunWith(AndroidJUnit4.class)
public final class NativeBackdropInsetsTest {

    @Test
    public void backdropUpdatesPreserveInsetsOwnedBySafeArea() throws InterruptedException {
        Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        AtomicReference<MainActivity> launched = new AtomicReference<>();
        CountDownLatch resumed = new CountDownLatch(1);
        ActivityLifecycleCallback callback = (activity, stage) -> {
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
        try {
            // Continuous WebView animation need not make the main queue idle.
            assertTrue("MainActivity must resume", resumed.await(20, TimeUnit.SECONDS));
            instrumentation.runOnMainSync(() -> {
                MainActivity activity = launched.get();
                View decor = activity.getWindow().getDecorView();
                int[] original = padding(decor);
                try {
                    // Exercise the real Android DecorView and app drawables. The inset
                    // owner may use any of these shapes across WebView, IME and rotation.
                    int[][] ownedInsets = {
                        {0, 136, 0, 63},
                        {125, 0, 63, 0},
                        {0, 136, 0, 800},
                        {0, 0, 0, 0},
                    };
                    for (int[] expected : ownedInsets) {
                        decor.setPadding(expected[0], expected[1], expected[2], expected[3]);
                        for (boolean dark : new boolean[] {false, true, true, false}) {
                            activity.setNativeEdgeBackdropDark(dark);
                            assertArrayEquals(
                                "Backdrop replacement must preserve the inset owner's padding",
                                expected,
                                padding(decor)
                            );
                        }
                    }
                } finally {
                    decor.setPadding(original[0], original[1], original[2], original[3]);
                }
            });
        } finally {
            instrumentation.runOnMainSync(() -> {
                ActivityLifecycleMonitorRegistry.getInstance().removeLifecycleCallback(callback);
                if (launched.get() != null) launched.get().finish();
            });
        }
    }

    private static int[] padding(View view) {
        return new int[] {
            view.getPaddingLeft(), view.getPaddingTop(),
            view.getPaddingRight(), view.getPaddingBottom(),
        };
    }
}

package com.zenflow.app;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.Instrumentation;
import android.app.UiAutomation;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.SystemClock;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityManager;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import java.io.File;
import java.io.FileOutputStream;
import java.util.Arrays;
import java.util.List;

import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class TalkBackTraversalInstrumentedTest {
    private static final String TAG = "ZenFlowTalkBackProbe";
    private static final String TALKBACK_PACKAGE = "com.google.android.marvin.talkback";
    private static final List<String> WELCOME_ACTIONS = Arrays.asList(
            "Light",
            "Dark",
            "System",
            "English",
            "Українська",
            "Español",
            "Deutsch",
            "Français",
            "日本語",
            "العربية",
            "עברית",
            "Continue");

    @Test
    public void talkBackTraversesEveryWelcomeActionWithoutSuppressingTheService()
            throws Exception {
        Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        Context targetContext = instrumentation.getTargetContext();
        AccessibilityManager accessibilityManager =
                (AccessibilityManager) targetContext.getSystemService(Context.ACCESSIBILITY_SERVICE);

        Assume.assumeTrue(
                "TalkBack must be installed and enabled for this retained device proof",
                isTalkBackEnabled(accessibilityManager));

        UiAutomation automation = instrumentation.getUiAutomation(
                UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES);
        configureAutomation(automation);
        launchWelcomeScreen(targetContext, automation);

        Log.i(TAG, "TRAVERSAL_BEGIN count=" + WELCOME_ACTIONS.size());
        for (int index = 0; index < WELCOME_ACTIONS.size(); index += 1) {
            String label = WELCOME_ACTIONS.get(index);
            AccessibilityNodeInfo node = waitForExactTextNode(automation, label, 15_000L);
            assertNotNull("Missing welcome action: " + label, node);

            AccessibilityEvent focusedEvent = automation.executeAndWaitForEvent(
                    () -> assertTrue(
                            "Accessibility focus action failed for " + label,
                            node.performAction(AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS)),
                    event -> event.getEventType()
                            == AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUSED,
                    5_000L);

            assertNotNull("No accessibility-focus event for " + label, focusedEvent);
            assertTrue("Focused event did not resolve to " + label,
                    eventMatchesLabel(focusedEvent, label));
            Log.i(TAG, "FOCUSED index=" + index + " label=" + label);

            // Keep each item focused long enough for the real TalkBack service to enqueue speech.
            SystemClock.sleep(1_250L);
        }
        captureFinalFocusScreenshot(targetContext, automation);
        Log.i(TAG, "TRAVERSAL_END count=" + WELCOME_ACTIONS.size());
    }

    private static boolean isTalkBackEnabled(AccessibilityManager manager) {
        if (manager == null || !manager.isEnabled()) {
            return false;
        }
        for (AccessibilityServiceInfo service
                : manager.getEnabledAccessibilityServiceList(
                        AccessibilityServiceInfo.FEEDBACK_ALL_MASK)) {
            if (service.getResolveInfo() != null
                    && service.getResolveInfo().serviceInfo != null
                    && TALKBACK_PACKAGE.equals(
                            service.getResolveInfo().serviceInfo.packageName)) {
                return true;
            }
        }
        return false;
    }

    private static void launchWelcomeScreen(Context targetContext, UiAutomation automation)
            throws Exception {
        Intent launchIntent = targetContext.getPackageManager()
                .getLaunchIntentForPackage(targetContext.getPackageName());
        assertNotNull("ZenFlow launch intent must exist", launchIntent);
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        targetContext.startActivity(launchIntent);
        automation.waitForIdle(1_000L, 20_000L);
        AccessibilityNodeInfo title = waitForExactTextNode(
                automation,
                "Welcome to ZenFlow",
                20_000L);
        if (title == null) {
            logVisibleWindows(automation);
        }
        assertNotNull("Welcome screen did not expose its title", title);
    }

    private static void configureAutomation(UiAutomation automation) {
        AccessibilityServiceInfo serviceInfo = automation.getServiceInfo();
        serviceInfo.flags |= AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS
                | AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
                | AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
        automation.setServiceInfo(serviceInfo);
    }

    private static void captureFinalFocusScreenshot(
            Context targetContext,
            UiAutomation automation) throws Exception {
        Bitmap screenshot = automation.takeScreenshot();
        assertNotNull("UiAutomation must capture the final TalkBack focus", screenshot);
        File screenshotFile = new File(
                targetContext.getFilesDir(),
                "talkback-traversal-final.png");
        try (FileOutputStream output = new FileOutputStream(screenshotFile)) {
            assertTrue(
                    "Final TalkBack focus screenshot must be encoded as PNG",
                    screenshot.compress(Bitmap.CompressFormat.PNG, 100, output));
        }
        Log.i(TAG, "SCREENSHOT path=" + screenshotFile.getAbsolutePath());
    }

    private static AccessibilityNodeInfo waitForExactTextNode(
            UiAutomation automation,
            String expectedText,
            long timeoutMillis) throws InterruptedException {
        long deadline = SystemClock.uptimeMillis() + timeoutMillis;
        do {
            AccessibilityNodeInfo activeRoot = automation.getRootInActiveWindow();
            AccessibilityNodeInfo activeMatch = findExactTextNode(activeRoot, expectedText);
            if (activeMatch != null) {
                return activeMatch;
            }
            for (AccessibilityWindowInfo window : automation.getWindows()) {
                AccessibilityNodeInfo windowMatch = findExactTextNode(
                        window.getRoot(),
                        expectedText);
                if (windowMatch != null) {
                    return windowMatch;
                }
            }
            SystemClock.sleep(200L);
        } while (SystemClock.uptimeMillis() < deadline);
        return null;
    }

    private static void logVisibleWindows(UiAutomation automation) {
        for (AccessibilityWindowInfo window : automation.getWindows()) {
            AccessibilityNodeInfo root = window.getRoot();
            Log.i(TAG, "WINDOW title=" + window.getTitle()
                    + " package=" + (root == null ? null : root.getPackageName())
                    + " class=" + (root == null ? null : root.getClassName()));
            logNodeTree(root, 0, 10);
        }
    }

    private static void logNodeTree(AccessibilityNodeInfo node, int depth, int maxDepth) {
        if (node == null || depth > maxDepth) {
            return;
        }
        Log.i(TAG, "NODE depth=" + depth
                + " class=" + node.getClassName()
                + " text=" + node.getText()
                + " description=" + node.getContentDescription()
                + " children=" + node.getChildCount());
        for (int index = 0; index < node.getChildCount(); index += 1) {
            logNodeTree(node.getChild(index), depth + 1, maxDepth);
        }
    }

    private static AccessibilityNodeInfo findExactTextNode(
            AccessibilityNodeInfo root,
            String expectedText) {
        if (root == null) {
            return null;
        }
        CharSequence rootText = root.getText();
        CharSequence rootDescription = root.getContentDescription();
        if (matchesText(expectedText, rootText)
                || matchesText(expectedText, rootDescription)) {
            return root;
        }
        for (int index = 0; index < root.getChildCount(); index += 1) {
            AccessibilityNodeInfo childMatch = findExactTextNode(
                    root.getChild(index),
                    expectedText);
            if (childMatch != null) {
                return childMatch;
            }
        }
        return null;
    }

    private static boolean eventMatchesLabel(AccessibilityEvent event, String expectedText) {
        AccessibilityNodeInfo source = event.getSource();
        if (source == null) {
            return false;
        }
        CharSequence text = source.getText();
        CharSequence description = source.getContentDescription();
        return matchesText(expectedText, text)
                || matchesText(expectedText, description);
    }

    private static boolean matchesText(String expectedText, CharSequence actualText) {
        return actualText != null && expectedText.contentEquals(actualText);
    }
}

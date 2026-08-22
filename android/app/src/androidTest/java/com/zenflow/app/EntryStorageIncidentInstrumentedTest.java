package com.zenflow.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import android.app.Instrumentation;
import android.app.UiAutomation;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.webkit.WebView;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

@RunWith(AndroidJUnit4.class)
public class EntryStorageIncidentInstrumentedTest {

    private static final long WEB_TIMEOUT_MS = 20_000L;

    @Test
    public void hebrewEntryTimeoutReflowsInsideTheAuthScreen() throws Exception {
        Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();

        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            AtomicReference<WebView> webViewRef = new AtomicReference<>();
            scenario.onActivity(activity -> webViewRef.set(activity.getBridge().getWebView()));
            WebView webView = webViewRef.get();

            waitForValue(instrumentation, webView, "document.readyState", "complete");
            waitForValue(
                    instrumentation,
                    webView,
                    "(() => {"
                            + "const auth=document.querySelector('[data-testid=auth-screen]');"
                            + "if(auth)return 'auth';"
                            + "const he=document.querySelector('[data-testid=language-option-he]');"
                            + "if(he && he.getAttribute('aria-checked')!=='true'){he.click();return 'selected';}"
                            + "const next=document.querySelector('[data-testid=language-continue]');"
                            + "if(next && !next.disabled){next.click();return 'continuing';}"
                            + "return 'waiting';"
                            + "})()",
                    "auth");

            evaluate(
                    instrumentation,
                    webView,
                    "window.dispatchEvent(new CustomEvent('zenflow:indexeddb-timeout',{detail:{"
                            + "code:'IDB_OPERATION_TIMEOUT',phase:'read',deadlineMs:30000,"
                            + "recoveryState:'cached'}}));'sent'");

            String rawLayout = waitForJson(instrumentation, webView);
            JSONObject layout = new JSONObject(rawLayout);
            System.out.println("T151 entry layout: " + rawLayout);
            assertEquals("rtl", layout.getString("direction"));
            assertTrue(layout.getBoolean("insideEntryHost"));
            assertEquals("relative", layout.getString("position"));
            assertTrue(layout.getDouble("bannerWidth") > 0d);
            assertTrue(layout.getDouble("bannerHeight") > 0d);
            assertTrue(
                    "The storage incident must start after the auth panel",
                    layout.getDouble("bannerTop") >= layout.getDouble("panelBottom") - 1d);
            assertTrue(
                    "The privacy footer must start after the storage incident",
                    layout.getDouble("footerTop") >= layout.getDouble("bannerBottom") - 1d);
            assertTrue(layout.getDouble("closeWidth") >= 48d);
            assertTrue(layout.getDouble("closeHeight") >= 48d);
            assertTrue(layout.getBoolean("noHorizontalOverflow"));
            assertTrue(layout.getBoolean("authCanReachLegalCopy"));

            String retainedScreenshot =
                    "/sdcard/Download/t151-hebrew-entry-storage-incident.png";
            UiAutomation automation = instrumentation.getUiAutomation();
            evaluateWithoutResult(
                    instrumentation,
                    webView,
                    "(() => {const banner=document.querySelector("
                            + "'[data-testid=storage-error-banner]');"
                            + "const root=document.scrollingElement;"
                            + "const top=Math.max(0,"
                            + "banner.getBoundingClientRect().top+root.scrollTop-120);"
                            + "document.documentElement.style.scrollBehavior='auto';"
                            + "window.scrollTo(0,top);})()");
            SystemClock.sleep(250L);
            double visualScrollTop = Double.parseDouble(
                    decode(evaluate(instrumentation, webView, "String(window.scrollY)")));
            assertTrue("The native visual capture must reach the incident", visualScrollTop > 0d);
            SystemClock.sleep(750L);
            runShell(
                    automation,
                    "screencap -p " + retainedScreenshot);
            String retainedSize = runShell(
                    automation,
                    "wc -c " + retainedScreenshot).trim();
            long retainedBytes = Long.parseLong(retainedSize.split("\\s+")[0]);
            assertTrue(retainedBytes > 0L);
        }
    }

    private static void waitForValue(
            Instrumentation instrumentation,
            WebView webView,
            String script,
            String expected) throws Exception {
        long deadline = SystemClock.uptimeMillis() + WEB_TIMEOUT_MS;
        while (SystemClock.uptimeMillis() < deadline) {
            if (expected.equals(decode(evaluate(instrumentation, webView, script)))) {
                return;
            }
            SystemClock.sleep(250L);
        }
        throw new AssertionError("Timed out waiting for WebView state: " + expected);
    }

    private static String waitForJson(
            Instrumentation instrumentation,
            WebView webView) throws Exception {
        String script = "(() => {"
                + "const banner=document.querySelector('[data-testid=storage-error-banner]');"
                + "const auth=document.querySelector('[data-testid=auth-screen]');"
                + "const panel=document.querySelector('[data-testid=auth-screen-panel]');"
                + "const footer=document.querySelector('.entry-auth-footer');"
                + "if(!banner||!auth||!panel||!footer)return '';"
                + "const close=banner.querySelector('button[aria-label]');"
                + "const bannerRect=banner.getBoundingClientRect();"
                + "const panelRect=panel.getBoundingClientRect();"
                + "const footerRect=footer.getBoundingClientRect();"
                + "const rect=close.getBoundingClientRect();"
                + "const host=banner.closest('[data-storage-incident-host]');"
                + "const root=document.documentElement;"
                + "const legal=auth.querySelector('[data-testid=auth-privacy-copy]')"
                + "||Array.from(auth.querySelectorAll('p')).at(-1);"
                + "return JSON.stringify({"
                + "direction:getComputedStyle(auth).direction,"
                + "insideEntryHost:Boolean(host),"
                + "position:getComputedStyle(banner).position,"
                + "bannerWidth:bannerRect.width,bannerHeight:bannerRect.height,"
                + "bannerTop:bannerRect.top,bannerBottom:bannerRect.bottom,"
                + "panelBottom:panelRect.bottom,footerTop:footerRect.top,"
                + "authScrollTop:auth.scrollTop,authClientHeight:auth.clientHeight,"
                + "authScrollHeight:auth.scrollHeight,"
                + "documentScrollTop:root.scrollTop,"
                + "documentClientHeight:root.clientHeight,documentScrollHeight:root.scrollHeight,"
                + "closeWidth:rect.width,closeHeight:rect.height,"
                + "noHorizontalOverflow:root.scrollWidth<=root.clientWidth+1,"
                + "authCanReachLegalCopy:Boolean(legal)&&"
                + "legal.getBoundingClientRect().bottom+root.scrollTop<=root.scrollHeight+1"
                + "});"
                + "})()";

        long deadline = SystemClock.uptimeMillis() + WEB_TIMEOUT_MS;
        while (SystemClock.uptimeMillis() < deadline) {
            String decoded = decode(evaluate(instrumentation, webView, script));
            if (decoded.startsWith("{")) {
                return decoded;
            }
            SystemClock.sleep(250L);
        }
        throw new AssertionError("Timed out waiting for the entry storage incident layout");
    }

    private static String evaluate(
            Instrumentation instrumentation,
            WebView webView,
            String script) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        instrumentation.runOnMainSync(() ->
                webView.evaluateJavascript(script, value -> {
                    result.set(value);
                    latch.countDown();
                }));
        assertTrue("WebView evaluation timed out", latch.await(5, TimeUnit.SECONDS));
        return result.get();
    }

    private static void evaluateWithoutResult(
            Instrumentation instrumentation,
            WebView webView,
            String script) {
        instrumentation.runOnMainSync(() -> webView.evaluateJavascript(script, null));
    }

    private static String decode(String value) throws Exception {
        if (value == null || "null".equals(value)) {
            return "";
        }
        Object decoded = new JSONTokener(value).nextValue();
        if (decoded instanceof String) {
            return (String) decoded;
        }
        return new String(value.getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8);
    }

    private static String runShell(UiAutomation automation, String command) throws Exception {
        ParcelFileDescriptor descriptor = automation.executeShellCommand(command);
        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(
                        new ParcelFileDescriptor.AutoCloseInputStream(descriptor),
                        StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append('\n');
            }
        }
        return output.toString();
    }
}

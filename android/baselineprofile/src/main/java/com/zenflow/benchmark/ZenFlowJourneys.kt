package com.zenflow.benchmark

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Rect
import android.os.SystemClock
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Direction
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.UiObject2
import androidx.test.uiautomator.Until

private const val PACKAGE_NAME = "com.zenflow.app"
private const val WEBVIEW_CLASS_NAME = "android.webkit.WebView"
private const val RADIO_GROUP_CLASS_NAME = "android.widget.RadioGroup"
private const val THEME_OPTION_COUNT = 3
private const val APP_TIMEOUT_MS = 20_000L
private const val UI_TIMEOUT_MS = 8_000L
private const val RENDER_SAMPLE_COLUMNS = 7
private const val RENDER_SAMPLE_ROWS = 9
private const val MIN_RENDER_COLOR_BUCKETS = 4
private const val MIN_RENDER_LUMA_SPREAD = 18

/**
 * Release journeys shared by the profile generator and Macrobenchmarks.
 *
 * The interactions use the accessibility tree exposed by the production WebView;
 * no benchmark-only route, synthetic account, or production data is introduced.
 */
class ZenFlowJourneys(
    private val device: UiDevice = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()),
) {
    fun awaitApp() {
        check(device.wait(Until.hasObject(By.pkg(PACKAGE_NAME).depth(0)), APP_TIMEOUT_MS)) {
            "ZenFlow window did not become ready"
        }
        device.waitForIdle(UI_TIMEOUT_MS)
    }

    /**
     * Waits for the production WebView to expose a visibly rendered surface.
     * UIAutomator does not expose the React DOM on every Android WebView build,
     * so readiness cannot depend on English copy or a particular locale.
     * This check belongs in a Macrobenchmark setup block, outside frame timing.
     */
    fun awaitPublicEntrySurface() {
        awaitApp()
        val webView = device.wait(
            Until.findObject(By.clazz(WEBVIEW_CLASS_NAME).pkg(PACKAGE_NAME)),
            UI_TIMEOUT_MS,
        )
        checkNotNull(webView) { "ZenFlow WebView did not become ready" }

        val deadline = SystemClock.uptimeMillis() + UI_TIMEOUT_MS
        while (SystemClock.uptimeMillis() < deadline) {
            val screenshot = InstrumentationRegistry.getInstrumentation()
                .uiAutomation
                .takeScreenshot()
            try {
                if (hasRenderedSurface(screenshot, webView.visibleBounds)) return
            } finally {
                screenshot.recycle()
            }
            SystemClock.sleep(200)
        }

        error("ZenFlow WebView remained visually blank")
    }

    /**
     * Profiles private app journeys only when this benchmark device already has
     * a genuine signed-in session. A clean device may advance through language
     * choice to warm the public startup/auth path, but it never fabricates auth.
     */
    fun awaitSignedInShell(): Boolean {
        awaitApp()
        if (hasPrimaryDestination()) return true

        val welcomeContinue = findText("Continue")
        if (welcomeContinue != null && findText("Welcome to ZenFlow") != null) {
            welcomeContinue.click()
            device.waitForIdle(UI_TIMEOUT_MS)
        }

        if (findText("Sign in to continue") != null) return false
        return hasPrimaryDestination()
    }

    fun openOrb() = openPrimaryDestination("Orb")

    fun openHabits() = openPrimaryDestination("Habits")

    fun openDiary() = openPrimaryDestination("Diary")

    fun openPlanning() = openPrimaryDestination("Planning")

    fun openSettings() = openPrimaryDestination("Settings")

    fun openConnectedHistory() {
        openSettings()
        val history = findText("View history and undo") ?: run {
            swipeScrollable(Direction.DOWN)
            findText("View history and undo")
        }
        checkNotNull(history) { "Connected-record history entry was not reachable" }.click()
        device.waitForIdle(UI_TIMEOUT_MS)
    }

    fun exerciseCurrentSurfaceScroll() {
        swipeScrollable(Direction.DOWN)
        swipeScrollable(Direction.UP)
    }

    /**
     * Exercises the real public entry surface without creating an account or
     * injecting benchmark-only state. Readiness is established in the benchmark
     * setup block so screenshot sampling cannot contaminate frame metrics.
     */
    fun exercisePublicEntry() {
        val themeOptions = device.findObjects(
            By.clazz(RADIO_GROUP_CLASS_NAME).pkg(PACKAGE_NAME),
        )
            .firstOrNull { it.childCount == THEME_OPTION_COUNT }
            ?.children
            ?.filter { it.isClickable }
            ?.map { it.visibleCenter }
        check(themeOptions?.size == THEME_OPTION_COUNT) {
            "ZenFlow public theme controls were not reachable"
        }

        // Reversible visual transitions provide real RenderThread work without
        // advancing onboarding, creating an account, or inserting user data.
        themeOptions.forEach { target ->
            check(device.click(target.x, target.y)) {
                "ZenFlow public theme control did not receive input"
            }
            SystemClock.sleep(300)
        }
        device.waitForIdle(UI_TIMEOUT_MS)
    }

    private fun hasRenderedSurface(screenshot: Bitmap, rawBounds: Rect): Boolean {
        if (screenshot.width < 2 || screenshot.height < 2) return false

        val left = rawBounds.left.coerceIn(0, screenshot.width - 1)
        val top = rawBounds.top.coerceIn(0, screenshot.height - 1)
        val right = rawBounds.right.coerceIn(left + 1, screenshot.width)
        val bottom = rawBounds.bottom.coerceIn(top + 1, screenshot.height)
        val width = right - left
        val height = bottom - top
        if (width < 44 || height < 44) return false

        val colorBuckets = mutableSetOf<Int>()
        var minLuma = 255
        var maxLuma = 0
        for (row in 1..RENDER_SAMPLE_ROWS) {
            val y = top + (height * row / (RENDER_SAMPLE_ROWS + 1))
            for (column in 1..RENDER_SAMPLE_COLUMNS) {
                val x = left + (width * column / (RENDER_SAMPLE_COLUMNS + 1))
                val pixel = screenshot.getPixel(
                    x.coerceAtMost(screenshot.width - 1),
                    y.coerceAtMost(screenshot.height - 1),
                )
                val red = Color.red(pixel)
                val green = Color.green(pixel)
                val blue = Color.blue(pixel)
                colorBuckets += ((red / 32) shl 6) or ((green / 32) shl 3) or (blue / 32)
                val luma = (red * 299 + green * 587 + blue * 114) / 1_000
                minLuma = minOf(minLuma, luma)
                maxLuma = maxOf(maxLuma, luma)
            }
        }

        return colorBuckets.size >= MIN_RENDER_COLOR_BUCKETS &&
            maxLuma - minLuma >= MIN_RENDER_LUMA_SPREAD
    }

    private fun openPrimaryDestination(label: String) {
        awaitApp()
        var destination = findText(label)
        if (destination == null) {
            val navigationButton = findAnyDescription(
                "Open navigation",
                "Open menu",
                "Menu",
            )
            checkNotNull(navigationButton) { "Navigation trigger was not reachable for $label" }.click()
            device.waitForIdle(UI_TIMEOUT_MS)
            destination = findText(label)
        }
        checkNotNull(destination) { "Primary destination was not reachable: $label" }.click()
        device.waitForIdle(UI_TIMEOUT_MS)
    }

    private fun hasPrimaryDestination(): Boolean =
        findText("Orb") != null || findAnyDescription("Open navigation", "Open menu", "Menu") != null

    private fun findText(text: String): UiObject2? =
        device.wait(Until.findObject(By.text(text)), UI_TIMEOUT_MS)

    private fun findAnyDescription(vararg descriptions: String): UiObject2? {
        for (description in descriptions) {
            val match = device.findObject(By.desc(description))
            if (match != null) return match
        }
        return null
    }

    private fun swipeScrollable(direction: Direction) {
        val scrollable = device.findObject(By.scrollable(true))
            ?: device.findObject(By.pkg(PACKAGE_NAME).depth(0))
            ?: return
        scrollable.swipe(direction, 0.65f)
        SystemClock.sleep(350)
        device.waitForIdle(UI_TIMEOUT_MS)
    }
}

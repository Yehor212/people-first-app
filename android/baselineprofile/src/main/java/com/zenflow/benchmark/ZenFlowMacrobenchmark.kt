package com.zenflow.benchmark

import androidx.benchmark.macro.BaselineProfileMode
import androidx.benchmark.macro.CompilationMode
import androidx.benchmark.macro.FrameTimingMetric
import androidx.benchmark.macro.StartupMode
import androidx.benchmark.macro.StartupTimingMetric
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import org.junit.Rule
import org.junit.Test
import org.junit.Assume.assumeTrue
import org.junit.runner.RunWith

private const val TARGET_PACKAGE = "com.zenflow.app"

@LargeTest
@RunWith(AndroidJUnit4::class)
class ZenFlowMacrobenchmark {
    @get:Rule
    val benchmarkRule = MacrobenchmarkRule()

    @Test
    fun coldStartupNoCompilation() = measureColdStartup(CompilationMode.None())

    @Test
    fun coldStartupBaselineProfile() = measureColdStartup(
        CompilationMode.Partial(BaselineProfileMode.Require),
    )

    @Test
    fun criticalNavigationFrames() {
        benchmarkRule.measureRepeated(
            packageName = TARGET_PACKAGE,
            metrics = listOf(FrameTimingMetric()),
            compilationMode = CompilationMode.Partial(BaselineProfileMode.Require),
            startupMode = StartupMode.WARM,
            iterations = 10,
            setupBlock = {
                pressHome()
                startActivityAndWait()
                assumeTrue(
                    "Critical navigation requires a genuine signed-in benchmark session",
                    ZenFlowJourneys().awaitSignedInShell(),
                )
            },
        ) {
            val journeys = ZenFlowJourneys()
            journeys.openHabits()
            journeys.exerciseCurrentSurfaceScroll()
            journeys.openDiary()
            journeys.exerciseCurrentSurfaceScroll()
            journeys.openPlanning()
            journeys.exerciseCurrentSurfaceScroll()
            journeys.openSettings()
            journeys.exerciseCurrentSurfaceScroll()
            journeys.openOrb()
        }
    }

    @Test
    fun publicEntryFrames() {
        benchmarkRule.measureRepeated(
            packageName = TARGET_PACKAGE,
            metrics = listOf(FrameTimingMetric()),
            compilationMode = CompilationMode.Partial(BaselineProfileMode.Require),
            startupMode = StartupMode.WARM,
            iterations = 10,
            setupBlock = {
                pressHome()
                startActivityAndWait()
                ZenFlowJourneys().awaitPublicEntrySurface()
            },
        ) {
            val journeys = ZenFlowJourneys()
            journeys.exercisePublicEntry()
        }
    }

    private fun measureColdStartup(compilationMode: CompilationMode) {
        benchmarkRule.measureRepeated(
            packageName = TARGET_PACKAGE,
            metrics = listOf(StartupTimingMetric()),
            compilationMode = compilationMode,
            startupMode = StartupMode.COLD,
            iterations = 10,
            setupBlock = { pressHome() },
        ) {
            startActivityAndWait()
            ZenFlowJourneys().awaitApp()
        }
    }
}

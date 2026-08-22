package com.zenflow.benchmark

import androidx.benchmark.macro.junit4.BaselineProfileRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

private const val TARGET_PACKAGE = "com.zenflow.app"

@LargeTest
@RunWith(AndroidJUnit4::class)
class BaselineProfileGenerator {
    @get:Rule
    val baselineProfileRule = BaselineProfileRule()

    @Test
    fun startup() = baselineProfileRule.collect(
        packageName = TARGET_PACKAGE,
        includeInStartupProfile = true,
    ) {
        pressHome()
        startActivityAndWait()
        ZenFlowJourneys().awaitApp()
    }

    @Test
    fun criticalJourneys() = baselineProfileRule.collect(
        packageName = TARGET_PACKAGE,
        includeInStartupProfile = false,
    ) {
        val journeys = ZenFlowJourneys()
        pressHome()
        startActivityAndWait()
        if (!journeys.awaitSignedInShell()) return@collect
        journeys.openOrb()
        journeys.openHabits()
        journeys.openDiary()
        journeys.openPlanning()
        journeys.openSettings()
        journeys.openConnectedHistory()
    }
}

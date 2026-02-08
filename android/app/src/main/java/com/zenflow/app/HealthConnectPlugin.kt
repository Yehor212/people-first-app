package com.zenflow.app

import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.MindfulnessSessionRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.temporal.ChronoUnit

/**
 * Health Connect Plugin for ZenFlow
 *
 * Full Kotlin implementation using the Health Connect SDK.
 * Provides:
 * - Availability & permission checking
 * - Write focus sessions as Mindfulness records
 * - Read sleep and step data
 * - Open Health Connect settings
 *
 * All methods resolve with safe defaults on error (never crash).
 */
@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {

    companion object {
        private const val TAG = "HealthConnectPlugin"
        private const val HEALTH_CONNECT_PACKAGE = "com.google.android.apps.healthdata"
    }

    // Coroutine scope tied to plugin lifecycle
    private val pluginJob = SupervisorJob()
    private val pluginScope = CoroutineScope(Dispatchers.Main + pluginJob)

    // Health Connect client — lazily initialized in load()
    private var healthConnectClient: HealthConnectClient? = null

    // The permissions we request
    private val requiredPermissions = setOf(
        HealthPermission.getWritePermission(MindfulnessSessionRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(StepsRecord::class),
    )

    // Permission request contract from Health Connect SDK
    private val requestPermissionContract =
        PermissionController.createRequestPermissionResultContract()

    // =========================================================================
    // Lifecycle
    // =========================================================================

    override fun load() {
        super.load()
        try {
            val status = HealthConnectClient.getSdkStatus(context)
            if (status == HealthConnectClient.SDK_AVAILABLE) {
                healthConnectClient = HealthConnectClient.getOrCreate(context)
                Log.d(TAG, "HealthConnectClient initialized")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not initialize HealthConnectClient", e)
        }
    }

    override fun handleOnDestroy() {
        super.handleOnDestroy()
        pluginScope.cancel()
    }

    // =========================================================================
    // isAvailable()
    // =========================================================================

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val result = JSObject()
        try {
            val status = HealthConnectClient.getSdkStatus(context)
            when (status) {
                HealthConnectClient.SDK_AVAILABLE -> {
                    if (healthConnectClient == null) {
                        healthConnectClient = HealthConnectClient.getOrCreate(context)
                    }
                    result.put("available", true)
                    Log.d(TAG, "Health Connect SDK available")
                }
                HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> {
                    result.put("available", false)
                    result.put("reason", "update_required")
                    Log.d(TAG, "Health Connect provider update required")
                }
                else -> {
                    result.put("available", false)
                    result.put("reason", "not_supported")
                    Log.d(TAG, "Health Connect SDK unavailable")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error checking SDK status", e)
            result.put("available", false)
            result.put("reason", "not_supported")
        }
        call.resolve(result)
    }

    // =========================================================================
    // checkPermissions()
    // =========================================================================

    @PluginMethod
    fun checkPermissions(call: PluginCall) {
        val client = healthConnectClient
        if (client == null) {
            call.resolve(buildPermissionsResult(emptySet()))
            return
        }

        pluginScope.launch {
            try {
                val granted = client.permissionController.getGrantedPermissions()
                call.resolve(buildPermissionsResult(granted))
            } catch (e: Exception) {
                Log.e(TAG, "Error checking permissions", e)
                call.resolve(buildPermissionsResult(emptySet()))
            }
        }
    }

    // =========================================================================
    // requestPermissions()
    // =========================================================================

    @PluginMethod
    fun requestPermissions(call: PluginCall) {
        val client = healthConnectClient
        if (client == null) {
            call.resolve(buildPermissionsResult(emptySet()))
            return
        }

        pluginScope.launch {
            try {
                // Check if all permissions are already granted
                val granted = client.permissionController.getGrantedPermissions()
                if (granted.containsAll(requiredPermissions)) {
                    call.resolve(buildPermissionsResult(granted))
                    return@launch
                }

                // Create intent from the Health Connect permission contract
                val intent = requestPermissionContract.createIntent(
                    context,
                    requiredPermissions
                )

                // Launch the permission activity; result handled in onPermissionResult
                startActivityForResult(call, intent, "onPermissionResult")
            } catch (e: Exception) {
                Log.e(TAG, "Error requesting permissions", e)
                // Fallback: open Health Connect settings
                try {
                    val settingsIntent = Intent("androidx.health.ACTION_HEALTH_CONNECT_SETTINGS")
                    settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(settingsIntent)
                } catch (_: Exception) { }
                call.resolve(buildPermissionsResult(emptySet()))
            }
        }
    }

    @ActivityCallback
    private fun onPermissionResult(call: PluginCall, result: ActivityResult) {
        val client = healthConnectClient
        if (client == null) {
            call.resolve(buildPermissionsResult(emptySet()))
            return
        }

        // Re-query SDK for granted permissions (more reliable than parsing result)
        pluginScope.launch {
            try {
                val granted = client.permissionController.getGrantedPermissions()
                call.resolve(buildPermissionsResult(granted))
            } catch (e: Exception) {
                Log.e(TAG, "Error checking permissions after request", e)
                call.resolve(buildPermissionsResult(emptySet()))
            }
        }
    }

    // =========================================================================
    // writeMindfulnessSession()
    // =========================================================================

    @PluginMethod
    fun writeMindfulnessSession(call: PluginCall) {
        val client = healthConnectClient
        if (client == null) {
            call.resolve(failedWriteResult())
            return
        }

        pluginScope.launch {
            try {
                val startTimeMs = call.getLong("startTime")
                if (startTimeMs == null) {
                    Log.e(TAG, "writeMindfulnessSession: missing startTime")
                    call.resolve(failedWriteResult())
                    return@launch
                }

                val durationMinutes = call.getInt("durationMinutes")
                if (durationMinutes == null || durationMinutes <= 0) {
                    Log.e(TAG, "writeMindfulnessSession: invalid durationMinutes")
                    call.resolve(failedWriteResult())
                    return@launch
                }

                val title = call.getString("title") ?: "Focus Session"

                val startInstant = Instant.ofEpochMilli(startTimeMs)
                val endInstant = startInstant.plus(durationMinutes.toLong(), ChronoUnit.MINUTES)

                val record = MindfulnessSessionRecord(
                    startTime = startInstant,
                    startZoneOffset = null,
                    endTime = endInstant,
                    endZoneOffset = null,
                    title = title,
                    mindfulnessSessionType =
                        MindfulnessSessionRecord.MINDFULNESS_SESSION_TYPE_MEDITATION,
                )

                val response = client.insertRecords(listOf(record))
                val insertedId = response.recordIdsList.firstOrNull() ?: ""

                val result = JSObject()
                result.put("success", true)
                result.put("sessionId", insertedId)
                call.resolve(result)

                Log.d(TAG, "Mindfulness session written: $insertedId")
            } catch (e: Exception) {
                Log.e(TAG, "Error writing mindfulness session", e)
                call.resolve(failedWriteResult())
            }
        }
    }

    // =========================================================================
    // readSleepSessions()
    // =========================================================================

    @PluginMethod
    fun readSleepSessions(call: PluginCall) {
        val client = healthConnectClient
        if (client == null) {
            call.resolve(emptySleepResult())
            return
        }

        pluginScope.launch {
            try {
                val now = Instant.now()
                val startTime = if (call.hasOption("startTime")) {
                    Instant.ofEpochMilli(call.getLong("startTime")!!)
                } else {
                    now.minus(7, ChronoUnit.DAYS)
                }
                val endTime = if (call.hasOption("endTime")) {
                    Instant.ofEpochMilli(call.getLong("endTime")!!)
                } else {
                    now
                }

                val request = ReadRecordsRequest(
                    recordType = SleepSessionRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(startTime, endTime),
                )

                val response = client.readRecords(request)
                val sessionsArray = JSArray()

                for (record in response.records) {
                    val sessionObj = JSObject()
                    sessionObj.put("id", record.metadata.id)
                    sessionObj.put("startTime", record.startTime.toEpochMilli())
                    sessionObj.put("endTime", record.endTime.toEpochMilli())
                    val durationMs = record.endTime.toEpochMilli() - record.startTime.toEpochMilli()
                    sessionObj.put("durationMinutes", (durationMs / 60_000).toInt())
                    record.title?.let { sessionObj.put("title", it) }
                    sessionsArray.put(sessionObj)
                }

                val result = JSObject()
                result.put("sessions", sessionsArray)
                result.put("count", response.records.size)
                call.resolve(result)

                Log.d(TAG, "Read ${response.records.size} sleep sessions")
            } catch (e: Exception) {
                Log.e(TAG, "Error reading sleep sessions", e)
                call.resolve(emptySleepResult())
            }
        }
    }

    // =========================================================================
    // readSteps()
    // =========================================================================

    @PluginMethod
    fun readSteps(call: PluginCall) {
        val client = healthConnectClient
        if (client == null) {
            call.resolve(emptyStepsResult())
            return
        }

        pluginScope.launch {
            try {
                val now = Instant.now()
                val startTime = if (call.hasOption("startTime")) {
                    Instant.ofEpochMilli(call.getLong("startTime")!!)
                } else {
                    now.minus(1, ChronoUnit.DAYS)
                }
                val endTime = if (call.hasOption("endTime")) {
                    Instant.ofEpochMilli(call.getLong("endTime")!!)
                } else {
                    now
                }

                val request = ReadRecordsRequest(
                    recordType = StepsRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(startTime, endTime),
                )

                val response = client.readRecords(request)
                val recordsArray = JSArray()
                var totalSteps: Long = 0

                for (record in response.records) {
                    val recordObj = JSObject()
                    recordObj.put("startTime", record.startTime.toEpochMilli())
                    recordObj.put("endTime", record.endTime.toEpochMilli())
                    recordObj.put("count", record.count)
                    recordsArray.put(recordObj)
                    totalSteps += record.count
                }

                val result = JSObject()
                result.put("totalSteps", totalSteps)
                result.put("records", recordsArray)
                result.put("recordCount", response.records.size)
                call.resolve(result)

                Log.d(TAG, "Read $totalSteps steps from ${response.records.size} records")
            } catch (e: Exception) {
                Log.e(TAG, "Error reading steps", e)
                call.resolve(emptyStepsResult())
            }
        }
    }

    // =========================================================================
    // openHealthConnect()
    // =========================================================================

    @PluginMethod
    fun openHealthConnect(call: PluginCall) {
        try {
            // Try Health Connect settings
            val intent = Intent("androidx.health.ACTION_HEALTH_CONNECT_SETTINGS")
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            call.resolve()
        } catch (_: Exception) {
            // Fallback: try launching the Health Connect app
            try {
                val launchIntent = context.packageManager
                    .getLaunchIntentForPackage(HEALTH_CONNECT_PACKAGE)
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(launchIntent)
                    call.resolve()
                } else {
                    openPlayStore(call)
                }
            } catch (_: Exception) {
                openPlayStore(call)
            }
        }
    }

    // =========================================================================
    // Private Helpers
    // =========================================================================

    /**
     * Build permissions result JSObject from granted permission set.
     */
    private fun buildPermissionsResult(granted: Set<String>): JSObject {
        val mindfulness = granted.contains(
            HealthPermission.getWritePermission(MindfulnessSessionRecord::class)
        )
        val sleep = granted.contains(
            HealthPermission.getReadPermission(SleepSessionRecord::class)
        )
        val steps = granted.contains(
            HealthPermission.getReadPermission(StepsRecord::class)
        )

        val result = JSObject()
        result.put("mindfulness", mindfulness)
        result.put("sleep", sleep)
        result.put("steps", steps)
        result.put("allGranted", mindfulness && sleep && steps)
        return result
    }

    private fun failedWriteResult(): JSObject {
        val result = JSObject()
        result.put("success", false)
        result.put("sessionId", "")
        return result
    }

    private fun emptySleepResult(): JSObject {
        val result = JSObject()
        result.put("sessions", JSArray())
        result.put("count", 0)
        return result
    }

    private fun emptyStepsResult(): JSObject {
        val result = JSObject()
        result.put("totalSteps", 0)
        result.put("records", JSArray())
        result.put("recordCount", 0)
        return result
    }

    /**
     * Open Health Connect in Google Play Store (last-resort fallback).
     */
    private fun openPlayStore(call: PluginCall) {
        try {
            val intent = Intent(Intent.ACTION_VIEW)
            intent.data = Uri.parse("market://details?id=$HEALTH_CONNECT_PACKAGE")
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            call.resolve()
        } catch (_: Exception) {
            try {
                val intent = Intent(Intent.ACTION_VIEW)
                intent.data = Uri.parse(
                    "https://play.google.com/store/apps/details?id=$HEALTH_CONNECT_PACKAGE"
                )
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
                call.resolve()
            } catch (e: Exception) {
                Log.e(TAG, "Could not open Play Store", e)
                call.reject("Could not open Health Connect")
            }
        }
    }
}

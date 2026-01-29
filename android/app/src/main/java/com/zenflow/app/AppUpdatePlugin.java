package com.zenflow.app;

import android.app.Activity;
import android.content.IntentSender;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;
import com.google.android.gms.tasks.Task;

@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    private static final int UPDATE_REQUEST_CODE = 500;
    private AppUpdateManager appUpdateManager;

    @Override
    public void load() {
        appUpdateManager = AppUpdateManagerFactory.create(getContext());
    }

    @PluginMethod
    public void checkForUpdate(PluginCall call) {
        Task<AppUpdateInfo> appUpdateInfoTask = appUpdateManager.getAppUpdateInfo();

        appUpdateInfoTask.addOnSuccessListener(info -> {
            JSObject result = new JSObject();
            result.put("updateAvailable", info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE);
            result.put("updatePriority", info.updatePriority());
            result.put("immediateAllowed", info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE));
            result.put("flexibleAllowed", info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE));
            result.put("availableVersionCode", info.availableVersionCode());
            result.put("stalenessDays", info.clientVersionStalenessDays() != null ? info.clientVersionStalenessDays() : 0);
            call.resolve(result);
        }).addOnFailureListener(e -> {
            call.reject("Failed to check for updates: " + e.getMessage());
        });
    }

    @PluginMethod
    public void startImmediateUpdate(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }

        Task<AppUpdateInfo> appUpdateInfoTask = appUpdateManager.getAppUpdateInfo();

        appUpdateInfoTask.addOnSuccessListener(info -> {
            if (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                    && info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
                try {
                    appUpdateManager.startUpdateFlowForResult(
                            info,
                            AppUpdateType.IMMEDIATE,
                            activity,
                            UPDATE_REQUEST_CODE
                    );
                    call.resolve();
                } catch (IntentSender.SendIntentException e) {
                    call.reject("Failed to start update flow: " + e.getMessage());
                }
            } else {
                call.reject("Immediate update not available");
            }
        }).addOnFailureListener(e -> {
            call.reject("Failed to get update info: " + e.getMessage());
        });
    }

    @PluginMethod
    public void startFlexibleUpdate(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }

        Task<AppUpdateInfo> appUpdateInfoTask = appUpdateManager.getAppUpdateInfo();

        appUpdateInfoTask.addOnSuccessListener(info -> {
            if (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                    && info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) {
                try {
                    appUpdateManager.startUpdateFlowForResult(
                            info,
                            AppUpdateType.FLEXIBLE,
                            activity,
                            UPDATE_REQUEST_CODE
                    );
                    call.resolve();
                } catch (IntentSender.SendIntentException e) {
                    call.reject("Failed to start update flow: " + e.getMessage());
                }
            } else {
                call.reject("Flexible update not available");
            }
        }).addOnFailureListener(e -> {
            call.reject("Failed to get update info: " + e.getMessage());
        });
    }

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject result = new JSObject();
        result.put("supported", true);
        call.resolve(result);
    }
}

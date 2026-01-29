package com.zenflow.app;

import android.app.Activity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.play.core.review.ReviewInfo;
import com.google.android.play.core.review.ReviewManager;
import com.google.android.play.core.review.ReviewManagerFactory;
import com.google.android.gms.tasks.Task;

@CapacitorPlugin(name = "Review")
public class ReviewPlugin extends Plugin {

    private ReviewManager reviewManager;
    private ReviewInfo reviewInfo;

    @Override
    public void load() {
        reviewManager = ReviewManagerFactory.create(getContext());
    }

    @PluginMethod
    public void requestReview(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }

        Task<ReviewInfo> request = reviewManager.requestReviewFlow();
        request.addOnCompleteListener(task -> {
            if (task.isSuccessful()) {
                reviewInfo = task.getResult();
                Task<Void> flow = reviewManager.launchReviewFlow(activity, reviewInfo);
                flow.addOnCompleteListener(flowTask -> {
                    // The flow has finished. The API does not indicate whether the user
                    // reviewed or not, or even whether the review dialog was shown.
                    call.resolve();
                });
            } else {
                // There was some problem, e.g. Google Play services not available
                call.reject("Failed to request review flow: " +
                    (task.getException() != null ? task.getException().getMessage() : "Unknown error"));
            }
        });
    }

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject result = new JSObject();
        result.put("supported", true);
        call.resolve(result);
    }
}

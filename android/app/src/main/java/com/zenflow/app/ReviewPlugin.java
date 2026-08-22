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
        Task<ReviewInfo> request = reviewManager.requestReviewFlow();
        request.addOnCompleteListener(task -> {
            if (task.isSuccessful()) {
                Activity activity = getActivity();
                if (activity == null) {
                    call.reject("Activity no longer available");
                    return;
                }
                reviewInfo = task.getResult();
                Task<Void> flow = reviewManager.launchReviewFlow(activity, reviewInfo);
                flow.addOnCompleteListener(flowTask -> {
                    call.resolve();
                });
            } else {
                call.reject("ZF_REVIEW_REQUEST_FAILED");
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

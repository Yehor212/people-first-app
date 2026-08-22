package com.zenflow.app;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bridges committed AndroidX Back events to the web shell only while ZenFlow
 * owns an in-app destination. Disabling the callback at the Orb root lets the
 * system provide predictive back-to-home instead of routing through JavaScript.
 */
@CapacitorPlugin(name = "AndroidBack")
public final class AndroidBackPlugin extends Plugin {

    private final AndroidBackNavigationState navigationState = new AndroidBackNavigationState();
    private OnBackPressedCallback backCallback;

    @Override
    public void load() {
        backCallback = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                JSObject event = new JSObject();
                event.put("canGoBack", getBridge().getWebView().canGoBack());
                event.put("hadVisibleLayer", navigationState.hasVisibleLayer());
                notifyListeners("backInvoked", event, true);
            }
        };
        getActivity().getOnBackPressedDispatcher().addCallback(getActivity(), backCallback);
    }

    @PluginMethod
    public void setState(PluginCall call) {
        Boolean canConsume = call.getBoolean("canConsume");
        if (canConsume == null || backCallback == null) {
            call.reject("INVALID_BACK_STATE");
            return;
        }

        // Optional for compatibility with an older bundled JS shell during a
        // forward/rollback transition. Older callers safely publish false.
        Boolean hasVisibleLayer = call.getBoolean("hasVisibleLayer");

        getBridge().executeOnMainThread(() -> {
            navigationState.update(canConsume, Boolean.TRUE.equals(hasVisibleLayer));
            backCallback.setEnabled(canConsume);
            JSObject state = new JSObject();
            state.put("canConsume", navigationState.canConsume());
            state.put("hasVisibleLayer", navigationState.hasVisibleLayer());
            call.resolve(state);
        });
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (backCallback != null) {
            backCallback.setEnabled(navigationState.canConsume());
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (backCallback != null) {
            backCallback.remove();
            backCallback = null;
        }
        super.handleOnDestroy();
    }
}

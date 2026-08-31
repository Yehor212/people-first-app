package com.zenflow.app;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * One AndroidX Back owner for the ZenFlow WebView.
 *
 * The callback is enabled only while ZenFlow has an in-app destination. At an
 * unobstructed Orb root it is disabled so Android owns predictive back-to-home.
 * AndroidX invokes handleOnBackPressed only for a committed gesture; a cancelled
 * gesture therefore cannot trigger JavaScript state or business actions.
 */
@CapacitorPlugin(name = "AndroidBack")
public final class AndroidBackPlugin extends Plugin {

    private final AndroidBackNavigationState navigationState = new AndroidBackNavigationState();
    private OnBackPressedCallback backCallback;

    @Override
    public void load() {
        backCallback = new OnBackPressedCallback(navigationState.canConsume()) {
            @Override
            public void handleOnBackPressed() {
                JSObject event = new JSObject();
                event.put("canGoBack", getBridge().getWebView().canGoBack());
                event.put("hadVisibleLayer", navigationState.hasVisibleLayer());
                event.put("revision", navigationState.revision());
                Logger.info(
                    getLogTag(),
                    "T182 commit revision=" + navigationState.revision() +
                        " visibleLayer=" + navigationState.hasVisibleLayer()
                );
                notifyListeners("backInvoked", event);
            }
        };
        getActivity().getOnBackPressedDispatcher().addCallback(getActivity(), backCallback);
    }

    @PluginMethod
    public void setState(PluginCall call) {
        Boolean canConsume = call.getBoolean("canConsume");
        Boolean hasVisibleLayer = call.getBoolean("hasVisibleLayer");
        if (canConsume == null || hasVisibleLayer == null || backCallback == null) {
            call.reject("INVALID_BACK_STATE");
            return;
        }

        getBridge().executeOnMainThread(() -> {
            long revision = navigationState.update(canConsume, hasVisibleLayer);
            backCallback.setEnabled(canConsume);
            Logger.info(
                getLogTag(),
                "T182 state revision=" + revision +
                    " canConsume=" + canConsume +
                    " visibleLayer=" + hasVisibleLayer
            );

            JSObject state = new JSObject();
            state.put("canConsume", navigationState.canConsume());
            state.put("hasVisibleLayer", navigationState.hasVisibleLayer());
            state.put("revision", revision);
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

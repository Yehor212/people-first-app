package com.zenflow.app;

import android.app.LocaleManager;
import android.content.res.Configuration;
import android.content.res.Resources;
import android.os.Build;
import android.os.LocaleList;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "ZenFlowLocale")
public class LocalePlugin extends Plugin {
    private static final Set<String> SUPPORTED_LANGUAGES = new HashSet<>(Arrays.asList(
            "en", "uk", "es", "de", "fr", "ja", "ar", "he"
    ));

    @PluginMethod
    public void setLocale(PluginCall call) {
        String language = call.getString("language");
        if (language == null || !SUPPORTED_LANGUAGES.contains(language)) {
            call.reject("Unsupported locale");
            return;
        }

        getBridge().executeOnMainThread(() -> {
            try {
                LocaleList locales = LocaleList.forLanguageTags(language);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    LocaleManager localeManager = getContext().getSystemService(LocaleManager.class);
                    if (localeManager == null) {
                        call.reject("Locale service unavailable");
                        return;
                    }
                    localeManager.setApplicationLocales(locales);
                } else {
                    Resources resources = getContext().getResources();
                    Configuration configuration = new Configuration(resources.getConfiguration());
                    configuration.setLocales(locales);
                    resources.updateConfiguration(configuration, resources.getDisplayMetrics());
                }

                JSObject result = new JSObject();
                result.put("language", language);
                call.resolve(result);
            } catch (Exception ignored) {
                call.reject("Failed to apply locale");
            }
        });
    }
}

package com.zenflow.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "Widget")
public class WidgetPlugin extends Plugin {

    private static final String PREFS_NAME = "zenflow_widget_prefs";
    private static final String DATA_KEY = "widget_data";

    @PluginMethod
    public void updateWidget(PluginCall call) {
        try {
            Context context = getContext();

            // Get data from call
            int streak = call.getInt("streak", 0);
            int habitsToday = call.getInt("habitsToday", 0);
            int habitsTotalToday = call.getInt("habitsTotalToday", 0);
            int focusMinutes = call.getInt("focusMinutes", 0);
            String lastBadge = call.getString("lastBadge", "");

            // Build JSON object
            JSONObject data = new JSONObject();
            data.put("streak", streak);
            data.put("habitsToday", habitsToday);
            data.put("habitsTotalToday", habitsTotalToday);
            data.put("focusMinutes", focusMinutes);
            data.put("lastBadge", lastBadge);

            // Handle habits array
            JSObject habitsObj = call.getObject("habits");
            if (habitsObj != null) {
                Object habitsArray = call.getArray("habits");
                if (habitsArray != null) {
                    data.put("habits", habitsArray);
                }
            }

            // Save to SharedPreferences
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();
            editor.putString(DATA_KEY, data.toString());
            editor.apply();

            // Update all widget types
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);

            // Update small widgets
            int[] smallIds = appWidgetManager.getAppWidgetIds(
                new ComponentName(context, WidgetProviderSmall.class)
            );
            for (int id : smallIds) {
                WidgetProviderSmall.updateAppWidget(context, appWidgetManager, id);
            }

            // Update medium widgets
            int[] mediumIds = appWidgetManager.getAppWidgetIds(
                new ComponentName(context, WidgetProviderMedium.class)
            );
            for (int id : mediumIds) {
                WidgetProviderMedium.updateAppWidget(context, appWidgetManager, id);
            }

            // Update large widgets
            int[] largeIds = appWidgetManager.getAppWidgetIds(
                new ComponentName(context, WidgetProviderLarge.class)
            );
            for (int id : largeIds) {
                WidgetProviderLarge.updateAppWidget(context, appWidgetManager, id);
            }

            call.resolve();

        } catch (Exception e) {
            call.reject("Failed to update widget: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getWidgetData(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String dataJson = prefs.getString(DATA_KEY, "{}");

            JSONObject data = new JSONObject(dataJson);

            JSObject result = new JSObject();
            result.put("streak", data.optInt("streak", 0));
            result.put("habitsToday", data.optInt("habitsToday", 0));
            result.put("habitsTotalToday", data.optInt("habitsTotalToday", 0));
            result.put("focusMinutes", data.optInt("focusMinutes", 0));
            result.put("lastBadge", data.optString("lastBadge", ""));

            call.resolve(result);

        } catch (Exception e) {
            call.reject("Failed to get widget data: " + e.getMessage());
        }
    }

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject result = new JSObject();
        result.put("supported", true);
        call.resolve(result);
    }
}

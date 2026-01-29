package com.zenflow.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

public class WidgetProviderLarge extends AppWidgetProvider {

    private static final String PREFS_NAME = "zenflow_widget_prefs";
    private static final String DATA_KEY = "widget_data";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_large);

        // Get data from SharedPreferences
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String dataJson = prefs.getString(DATA_KEY, "{}");

        try {
            JSONObject data = new JSONObject(dataJson);

            int streak = data.optInt("streak", 0);
            int habitsToday = data.optInt("habitsToday", 0);
            int habitsTotalToday = data.optInt("habitsTotalToday", 0);
            int focusMinutes = data.optInt("focusMinutes", 0);
            String lastBadge = data.optString("lastBadge", "");

            // Update views
            views.setTextViewText(R.id.streak_count, String.valueOf(streak));
            views.setTextViewText(R.id.habits_progress, habitsToday + "/" + habitsTotalToday);
            views.setTextViewText(R.id.focus_minutes, String.valueOf(focusMinutes));

            // Update badge
            if (!lastBadge.isEmpty()) {
                views.setViewVisibility(R.id.badge_container, View.VISIBLE);
                views.setTextViewText(R.id.last_badge, lastBadge);
            } else {
                views.setViewVisibility(R.id.badge_container, View.GONE);
            }

        } catch (Exception e) {
            // Use default values
            views.setTextViewText(R.id.streak_count, "0");
            views.setTextViewText(R.id.habits_progress, "0/0");
            views.setTextViewText(R.id.focus_minutes, "0");
            views.setViewVisibility(R.id.badge_container, View.GONE);
        }

        // Set click intent to open the app
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_container, pendingIntent);

        // Update the widget
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    @Override
    public void onEnabled(Context context) {
        // Called when first widget is created
    }

    @Override
    public void onDisabled(Context context) {
        // Called when last widget is removed
    }
}

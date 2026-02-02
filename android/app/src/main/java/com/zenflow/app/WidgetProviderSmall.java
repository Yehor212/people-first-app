package com.zenflow.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import org.json.JSONObject;

public class WidgetProviderSmall extends AppWidgetProvider {

    private static final String PREFS_NAME = "zenflow_widget_prefs";
    private static final String DATA_KEY = "widget_data";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_small);

        // Get data from SharedPreferences
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String dataJson = prefs.getString(DATA_KEY, "{}");

        int streak = 0;
        int habitsToday = 0;
        int habitsTotalToday = 0;

        try {
            JSONObject data = new JSONObject(dataJson);

            streak = data.optInt("streak", 0);
            habitsToday = data.optInt("habitsToday", 0);
            habitsTotalToday = data.optInt("habitsTotalToday", 0);

            // Update views
            views.setTextViewText(R.id.streak_count, String.valueOf(streak));
            views.setTextViewText(R.id.habits_progress, habitsToday + "/" + habitsTotalToday);

        } catch (Exception e) {
            // Use default values
            views.setTextViewText(R.id.streak_count, "0");
            views.setTextViewText(R.id.habits_progress, "0/0");
        }

        // Generate smart insight message
        String insight = getSmartInsight(streak, habitsToday, habitsTotalToday);
        views.setTextViewText(R.id.insight_message, insight);

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

    /**
     * Generate a smart insight message based on current stats
     */
    private static String getSmartInsight(int streak, int habitsToday, int habitsTotalToday) {
        // Streak milestones
        if (streak == 7) return "🎉 1 week streak!";
        if (streak == 14) return "🔥 2 weeks strong!";
        if (streak == 30) return "🏆 30 day champion!";
        if (streak == 100) return "💯 100 day legend!";

        // Completion status
        if (habitsTotalToday > 0 && habitsToday == habitsTotalToday) {
            return "✨ All done today!";
        }

        int remaining = habitsTotalToday - habitsToday;
        if (remaining == 1) {
            return "🎯 1 habit to go!";
        }
        if (remaining > 1 && remaining <= 3) {
            return "💪 " + remaining + " habits left";
        }

        if (habitsToday == 0 && habitsTotalToday > 0) {
            return "🚀 Start your day!";
        }

        // Default based on streak
        if (streak > 0) {
            return "🔥 Keep going!";
        }

        return "";
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

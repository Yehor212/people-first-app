package com.zenflow.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Resources;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
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
        Resources res = context.getResources();

        // Get data from SharedPreferences
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String dataJson = prefs.getString(DATA_KEY, "{}");

        int streak = 0;
        int habitsToday = 0;
        int habitsTotalToday = 0;
        int focusMinutes = 0;
        String lastBadge = "";
        JSONArray habits = null;

        try {
            JSONObject data = new JSONObject(dataJson);

            streak = data.optInt("streak", 0);
            habitsToday = data.optInt("habitsToday", 0);
            habitsTotalToday = data.optInt("habitsTotalToday", 0);
            focusMinutes = data.optInt("focusMinutes", 0);
            lastBadge = data.optString("lastBadge", "");
            habits = data.optJSONArray("habits");

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

            // Update habit list
            updateHabitList(views, habits, res, context);

        } catch (Exception e) {
            // Use default values
            views.setTextViewText(R.id.streak_count, "0");
            views.setTextViewText(R.id.habits_progress, "0/0");
            views.setTextViewText(R.id.focus_minutes, "0");
            views.setViewVisibility(R.id.badge_container, View.GONE);
            clearHabitList(views);
        }

        // Generate smart insight message
        String insight = getSmartInsight(streak, habitsToday, habitsTotalToday, focusMinutes, lastBadge);
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
     * Update the habit list in the widget
     */
    private static void updateHabitList(RemoteViews views, JSONArray habits, Resources res, Context context) {
        // Row IDs and their components
        int[] rowIds = {R.id.habit_row_1, R.id.habit_row_2, R.id.habit_row_3, R.id.habit_row_4};
        int[] checkIds = {R.id.habit_check_1, R.id.habit_check_2, R.id.habit_check_3, R.id.habit_check_4};
        int[] nameIds = {R.id.habit_name_1, R.id.habit_name_2, R.id.habit_name_3, R.id.habit_name_4};

        // Get colors from resources
        int completedColor = res.getColor(R.color.widget_habits, context.getTheme());
        int pendingColor = res.getColor(R.color.widget_text_muted, context.getTheme());
        int textColor = res.getColor(R.color.widget_text_primary, context.getTheme());

        if (habits == null || habits.length() == 0) {
            // Show empty state
            views.setViewVisibility(R.id.habits_empty_state, View.VISIBLE);
            for (int rowId : rowIds) {
                views.setViewVisibility(rowId, View.GONE);
            }
            return;
        }

        // Hide empty state
        views.setViewVisibility(R.id.habits_empty_state, View.GONE);

        // Populate habit rows (up to 4)
        int count = Math.min(habits.length(), 4);
        for (int i = 0; i < 4; i++) {
            if (i < count) {
                try {
                    JSONObject habit = habits.getJSONObject(i);
                    String name = habit.optString("name", "");
                    boolean completed = habit.optBoolean("completed", false);

                    views.setViewVisibility(rowIds[i], View.VISIBLE);
                    views.setTextViewText(nameIds[i], name);
                    views.setTextViewText(checkIds[i], completed ? "✓" : "○");
                    views.setTextColor(checkIds[i], completed ? completedColor : pendingColor);
                    views.setTextColor(nameIds[i], textColor);

                } catch (Exception e) {
                    views.setViewVisibility(rowIds[i], View.GONE);
                }
            } else {
                views.setViewVisibility(rowIds[i], View.GONE);
            }
        }
    }

    /**
     * Clear habit list when there's an error
     */
    private static void clearHabitList(RemoteViews views) {
        views.setViewVisibility(R.id.habits_empty_state, View.VISIBLE);
        views.setViewVisibility(R.id.habit_row_1, View.GONE);
        views.setViewVisibility(R.id.habit_row_2, View.GONE);
        views.setViewVisibility(R.id.habit_row_3, View.GONE);
        views.setViewVisibility(R.id.habit_row_4, View.GONE);
    }

    /**
     * Generate a smart insight message based on current stats
     */
    private static String getSmartInsight(int streak, int habitsToday, int habitsTotalToday, int focusMinutes, String lastBadge) {
        // Badge announcement
        if (!lastBadge.isEmpty()) {
            return "🏆 " + lastBadge;
        }

        // Streak milestones
        if (streak == 7) return "🎉 1 week streak!";
        if (streak == 14) return "🔥 2 weeks strong!";
        if (streak == 30) return "🏆 30 day champion!";
        if (streak == 100) return "💯 100 day legend!";

        // Focus milestones
        if (focusMinutes >= 120) return "🧠 Deep focus master!";
        if (focusMinutes >= 60) return "⚡ 1 hour focused!";

        // Completion status
        if (habitsTotalToday > 0 && habitsToday == habitsTotalToday) {
            return "✨ All habits done!";
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
            return "🔥 Keep the streak!";
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

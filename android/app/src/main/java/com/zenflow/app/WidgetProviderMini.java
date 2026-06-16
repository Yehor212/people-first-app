package com.zenflow.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

import org.json.JSONObject;

/**
 * Mini widget provider (2x1) — displays mood emoji + streak count.
 * Tapping the widget opens the diary tab via deep link.
 * Write button opens journal editor via deep link.
 */
public class WidgetProviderMini extends AppWidgetProvider {

    private static final String PREFS_NAME = "zenflow_widget_prefs";
    private static final String DATA_KEY = "widget_data";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_mini);

        // Get data from SharedPreferences
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String dataJson = prefs.getString(DATA_KEY, "{}");

        String moodEmoji = "\uD83D\uDE42"; // Default: 🙂
        int streak = 0;

        try {
            JSONObject data = new JSONObject(dataJson);
            moodEmoji = data.optString("currentMood", "\uD83D\uDE42");
            streak = data.optInt("streak", 0);
        } catch (Exception e) {
            // Use default values
        }

        // Update views
        views.setTextViewText(R.id.mood_emoji, moodEmoji);
        views.setTextViewText(R.id.streak_count, streak + " \uD83D\uDD25");

        // Deep link: tap widget root → open diary/mood
        Intent moodIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("zenflow://diary/mood"));
        moodIntent.setPackage(context.getPackageName());
        moodIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent moodPending = PendingIntent.getActivity(
            context,
            appWidgetId * 10,
            moodIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, moodPending);

        // Deep link: tap write button → open diary/editor
        Intent editorIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("zenflow://diary/editor"));
        editorIntent.setPackage(context.getPackageName());
        editorIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent editorPending = PendingIntent.getActivity(
            context,
            appWidgetId * 10 + 1,
            editorIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.write_button, editorPending);

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

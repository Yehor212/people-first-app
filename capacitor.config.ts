import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zenflow.app',
  appName: 'ZenFlow',
  webDir: 'dist',
  android: {
    webContentsDebuggingEnabled: false,
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      launchFadeOutDuration: 300,
      androidScaleType: 'CENTER_CROP',
    },
    LocalNotifications: {
      // Default icon color (emerald)
      iconColor: '#10B981',
      // Use default system sound
      sound: 'default',
      /**
       * IMPORTANT: Android Notification Channel Behavior
       *
       * Android notification channels are IMMUTABLE after creation.
       * Once a user installs the app, the following channel properties
       * CANNOT be changed programmatically:
       *   - importance/priority level
       *   - sound
       *   - vibration pattern
       *   - lights
       *
       * If you need to change these settings:
       * 1. Create a NEW channel with a different ID (e.g., 'zenflow_reminders_v2')
       * 2. Delete the old channel (optional, for cleanup)
       * 3. Update all notification code to use the new channel ID
       *
       * Users can still manually adjust these settings in Android System Settings.
       *
       * See: https://developer.android.com/develop/ui/views/notifications/channels
       */
    },
  },
};

export default config;

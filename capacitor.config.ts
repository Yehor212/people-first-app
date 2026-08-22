import type { CapacitorConfig } from "@capacitor/cli";

// T177: native plugins are allowlisted so the installed-but-runtime-dead
// advertising package cannot be linked or auto-registered while ads are OFF.
const nativePluginAllowlist = [
  "@capacitor-community/safe-area",
  "@capacitor/app",
  "@capacitor/browser",
  "@capacitor/filesystem",
  "@capacitor/haptics",
  "@capacitor/local-notifications",
  "@capacitor/push-notifications",
  "@capacitor/share",
  "@capacitor/splash-screen",
  "@capgo/capacitor-social-login",
];

const config: CapacitorConfig = {
  appId: "com.zenflow.app",
  appName: "ZenFlow",
  webDir: "dist",
  android: {
    webContentsDebuggingEnabled: false,
    allowMixedContent: false,
    includePlugins: [...nativePluginAllowlist],
  },
  ios: {
    scheme: "zenflow",
    contentInset: "never",
    includePlugins: [...nativePluginAllowlist],
  },
  server: {
    androidScheme: "https",
    iosScheme: "https",
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      launchFadeOutDuration: 300,
      androidScaleType: "CENTER_CROP",
    },
    LocalNotifications: {
      // Default icon color (emerald)
      iconColor: "#10B981",
      // Use default system sound
      sound: "default",
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
    SystemBars: {
      insetsHandling: "disable",
      style: "DEFAULT",
      hidden: false,
      animation: "NONE",
    },
    SafeArea: {
      initialViewportFitCover: true,
      detectViewportFitCoverChanges: true,
    },
  },
};

export default config;

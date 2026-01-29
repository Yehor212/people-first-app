import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zenflow.app',
  appName: 'ZenFlow',
  webDir: 'dist',
  android: {
    // Set to false for production release
    webContentsDebuggingEnabled: false,
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    LocalNotifications: {
      // Default icon color (emerald)
      iconColor: '#10B981',
      // Use default system sound
      sound: 'default',
    },
  },
};

export default config;

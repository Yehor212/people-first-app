import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zenflow.app',
  appName: 'ZenFlow',
  webDir: 'dist',
  android: {
    // Enable WebView debugging
    webContentsDebuggingEnabled: true,
    // Allow mixed content for debugging
    allowMixedContent: true,
  },
  server: {
    // Use relative URLs
    androidScheme: 'https',
    // Clear cache on reload
    cleartext: true,
  }
};

export default config;

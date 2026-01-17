import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zenflow.app',
  appName: 'ZenFlow',
  webDir: 'dist',
  android: {
    // DEBUG: Enable for development, disable for production release
    webContentsDebuggingEnabled: true,
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
    cleartext: false,
  }
};

export default config;

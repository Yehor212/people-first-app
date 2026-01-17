import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zenflow.app',
  appName: 'ZenFlow',
  webDir: 'dist',
  android: {
    // PRODUCTION: Disable debugging for security
    webContentsDebuggingEnabled: false,
    // PRODUCTION: Require HTTPS only
    allowMixedContent: false,
  },
  server: {
    // Use HTTPS scheme
    androidScheme: 'https',
    // PRODUCTION: Disable cleartext (HTTP) traffic
    cleartext: false,
  }
};

export default config;

/**
 * Biometric Authentication Plugin Interface
 *
 * Provides biometric (fingerprint/face/iris) authentication on Android.
 * Web fallback always returns unavailable.
 */

import { registerPlugin } from '@capacitor/core';

export interface BiometricAvailableResult {
  available: boolean;
  type?: 'fingerprint' | 'face' | 'iris' | 'multiple';
}

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
}

export interface BiometricPluginInterface {
  isAvailable(): Promise<BiometricAvailableResult>;
  authenticate(options: { reason: string }): Promise<BiometricAuthResult>;
}

// Web fallback
class BiometricWeb implements BiometricPluginInterface {
  async isAvailable(): Promise<BiometricAvailableResult> {
    return { available: false };
  }
  async authenticate(): Promise<BiometricAuthResult> {
    return { success: false, error: 'Biometric not available on web' };
  }
}

const BiometricAuth = registerPlugin<BiometricPluginInterface>('BiometricAuth', {
  web: () => new BiometricWeb(),
});

export default BiometricAuth;

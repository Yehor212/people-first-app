/**
 * Biometric Authentication Plugin Interface
 *
 * Provides native biometric authentication where a platform bridge is registered.
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
  secret?: string;
}

export interface BiometricPluginInterface {
  isAvailable(): Promise<BiometricAvailableResult>;
  enroll(options: { reason: string; secret?: string }): Promise<BiometricAuthResult>;
  unenroll(): Promise<BiometricAuthResult>;
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
  async enroll(): Promise<BiometricAuthResult> {
    return { success: false, error: 'Biometric not available on web' };
  }
  async unenroll(): Promise<BiometricAuthResult> {
    return { success: true };
  }
}

const BiometricAuth = registerPlugin<BiometricPluginInterface>('BiometricAuth', {
  web: () => new BiometricWeb(),
});

export default BiometricAuth;

/**
 * Screen Security Plugin Interface
 *
 * Controls FLAG_SECURE on Android to block screenshots and screen recording.
 * Web fallback is a no-op.
 */

import { registerPlugin } from '@capacitor/core';

export interface ScreenSecurityPluginInterface {
  enable(): Promise<void>;
  disable(): Promise<void>;
}

// Web fallback (no-op)
class ScreenSecurityWeb implements ScreenSecurityPluginInterface {
  async enable(): Promise<void> { /* no-op on web */ }
  async disable(): Promise<void> { /* no-op on web */ }
}

const ScreenSecurity = registerPlugin<ScreenSecurityPluginInterface>('ScreenSecurity', {
  web: () => new ScreenSecurityWeb(),
});

export default ScreenSecurity;

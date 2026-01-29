/**
 * DND (Do Not Disturb) Plugin Interface
 *
 * Provides access to device's Do Not Disturb status.
 * Used to respect user's DND preferences when sending notifications.
 */

import { registerPlugin } from '@capacitor/core';

// ============================================
// TYPES
// ============================================

export interface DndCheckResult {
  active: boolean;
  filter?: number;
  filterName?: 'all' | 'priority' | 'none' | 'alarms' | 'unknown';
  error?: string;
}

export interface DndStatusResult {
  available: boolean;
  filter?: number;
  filterName?: 'all' | 'priority' | 'none' | 'alarms' | 'unknown';
  allowAll?: boolean;
  priorityOnly?: boolean;
  alarmsOnly?: boolean;
  totalSilence?: boolean;
  error?: string;
}

export interface PolicyAccessResult {
  granted: boolean;
}

export interface DndPluginInterface {
  /**
   * Check if Do Not Disturb mode is currently active
   */
  isDndActive(): Promise<DndCheckResult>;

  /**
   * Get detailed DND status information
   */
  getDndStatus(): Promise<DndStatusResult>;

  /**
   * Check if app has notification policy access
   * (Required for modifying DND settings)
   */
  hasNotificationPolicyAccess(): Promise<PolicyAccessResult>;
}

// ============================================
// PLUGIN REGISTRATION
// ============================================

const DndPlugin = registerPlugin<DndPluginInterface>('Dnd', {
  web: () => import('./DndWeb').then(m => new m.DndWeb()),
});

export default DndPlugin;

/**
 * DND (Do Not Disturb) Plugin Interface
 *
 * Provides access to device's Do Not Disturb status.
 * Used to respect user's DND preferences when sending notifications.
 */

import { registerPlugin } from '@capacitor/core';
import type { DndPluginInterface } from './dndTypes';
export type {
  DndPluginInterface,
  DndCheckResult,
  DndStatusResult,
  PolicyAccessResult,
  SetDndResult,
} from './dndTypes';

// ============================================
// PLUGIN REGISTRATION
// ============================================

const DndPlugin = registerPlugin<DndPluginInterface>('Dnd', {
  web: () => import('./DndWeb').then(m => new m.DndWeb()),
});

export default DndPlugin;

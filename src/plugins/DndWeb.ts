/**
 * DND Plugin Web Implementation
 *
 * Web fallback for DND plugin.
 * Always returns DND as inactive since web doesn't have access to system DND state.
 */

import type {
  DndPluginInterface,
  DndCheckResult,
  DndStatusResult,
  PolicyAccessResult,
} from './DndPlugin';

export class DndWeb implements DndPluginInterface {
  async isDndActive(): Promise<DndCheckResult> {
    // Web doesn't have access to DND status
    // Return false to allow notifications
    return {
      active: false,
      filter: 1,
      filterName: 'all',
    };
  }

  async getDndStatus(): Promise<DndStatusResult> {
    // DND checking not available on web
    return {
      available: false,
    };
  }

  async hasNotificationPolicyAccess(): Promise<PolicyAccessResult> {
    // Not applicable on web
    return {
      granted: false,
    };
  }
}

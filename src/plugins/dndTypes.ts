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

export interface SetDndResult {
  success: boolean;
  error?: string;
}

export interface DndPluginInterface {
  isDndActive(): Promise<DndCheckResult>;
  getDndStatus(): Promise<DndStatusResult>;
  hasNotificationPolicyAccess(): Promise<PolicyAccessResult>;
  setDnd(options: { enabled: boolean }): Promise<SetDndResult>;
  requestPolicyAccess(): Promise<void>;
}

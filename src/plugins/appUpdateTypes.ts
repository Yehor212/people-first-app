export interface AppUpdateInfo {
  updateAvailable: boolean;
  updatePriority: number;
  immediateAllowed: boolean;
  flexibleAllowed: boolean;
  availableVersionCode: number;
  stalenessDays: number;
}

export interface AppUpdatePlugin {
  checkForUpdate(): Promise<AppUpdateInfo>;
  startImmediateUpdate(): Promise<void>;
  startFlexibleUpdate(): Promise<void>;
  isSupported(): Promise<{ supported: boolean }>;
}

export type KimiHookPaths = {
  configPath: string;
  hookPath: string;
};

export function renderKimiHookBlock(hookPath: string): string;

export function inspectKimiHook(input: KimiHookPaths): Promise<{
  duplicateMarkers: boolean;
  hookReady: boolean;
  installed: boolean;
  secureMode: boolean;
  stale: boolean;
}>;

export function applyKimiHook(
  input: KimiHookPaths & {
    now?: Date;
    beforeBackup?: () => void | Promise<void>;
    beforeReplace?: () => void | Promise<void>;
    beforeCommit?: () => void | Promise<void>;
  }
): Promise<{
  backupPath: string | null;
  changed: boolean;
  receiptPath: string | null;
}>;

export function restoreKimiBackup(input: {
  backupPath: string;
  beforeCommit?: () => void | Promise<void>;
  configPath: string;
  receiptPath: string;
}): Promise<void>;

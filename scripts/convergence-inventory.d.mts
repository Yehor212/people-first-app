export type InventoryOptions = {
  legacyRoot: string;
  canonicalRoot: string;
  outputDir: string;
  additionalRoots: string[];
  expectedMainSha: string;
};

export type InventorySnapshot = {
  schema: string;
  observedAt: string;
  expectedMainSha: string;
  registries: Array<Record<string, unknown>>;
  worktrees: Array<{
    activity: "ACTIVE_SKIP" | "FROZEN" | "UNVERIFIED";
    changeCount: number | null;
    ignoredCount: number | null;
    [key: string]: unknown;
  }>;
  refs: Array<{
    name: string;
    classification: "IN_MAIN" | "PATCH_EQUIVALENT" | "UNIQUE_COMMITS" | "UNRELATED";
    registryIds: string[];
    [key: string]: unknown;
  }>;
  pullRequests: Array<Record<string, unknown>>;
  warnings: string[];
  [key: string]: unknown;
};

export function parseArguments(argv: string[]): InventoryOptions;
export function validateOutputLocation(outputDir: string, repositoryRoots: string[]): string;
export function resolveAndValidateOutputLocation(
  outputDir: string,
  repositoryRoots: string[]
): Promise<string>;
export function sanitizeStatusEntry(
  code: string,
  statusPath: string
):
  | { code: string; path: string }
  | { code: string; pathCategory: "SECRET_LIKE"; pathHash: string };
export function collectInventory(
  options: InventoryOptions,
  dependencies?: Record<string, unknown>
): Promise<InventorySnapshot>;
export function renderPublicSummary(inventory: InventorySnapshot): Record<string, unknown>;
export function writePrivateSnapshots(input: {
  inventory: InventorySnapshot;
  outputDir: string;
  repositoryRoots: string[];
}): Promise<{ inventoryPath: string; summaryPath: string }>;

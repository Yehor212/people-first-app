export const INVENTORY_V2_SCHEMA_VERSION = "1.0.0";

export const ENUMERATOR_IDS = Object.freeze([
  "navigation",
  "surfaces-orbs",
  "gates-providers-background",
  "state-storage-sync",
  "ai-ads-notifications",
  "native-platform",
  "i18n-public-claims",
  "tests-observability-recovery",
  "legacy-assets",
]);

export const INVENTORY_V2_LIMITS = Object.freeze({
  maxFiles: 50_000,
  maxCandidates: 50_000,
  maxFileBytes: 16 * 1024 * 1024,
  maxTotalBytes: 512 * 1024 * 1024,
});

export const DENIED_DIRECTORY_NAMES = new Set([
  ".git",
  ".superpowers",
  "node_modules",
  "dist",
  "coverage",
  "output",
  ".cache",
]);

export const DENIED_FILE_NAMES = new Set([
  ".env",
  ".mcp.json",
  ".npmrc",
  "id_rsa",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
]);

export const DENIED_FILE_EXTENSIONS = new Set([".key", ".pem", ".p12", ".pfx", ".keystore"]);

export const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".gradle",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".kts",
  ".md",
  ".mjs",
  ".plist",
  ".properties",
  ".rs",
  ".sh",
  ".sql",
  ".swift",
  ".toml",
  ".ts",
  ".tsx",
  ".xml",
  ".yaml",
  ".yml",
  ".patch",
]);

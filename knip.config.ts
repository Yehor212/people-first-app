import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["src/sw.ts"],
  project: ["src/**/*.{ts,tsx}"],
  ignoreDependencies: [
    // Auto-registered by Capacitor native layer (no JS import)
    "@capacitor-community/safe-area",
  ],
};

export default config;

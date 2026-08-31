import type { Plugin } from "vite";

export const COMPACT_I18N_VIRTUAL_ID: string;
export const COMPACT_I18N_RESOLVED_ID: string;

export function parseCompactLocaleModule(
  source: string,
  fileName: string,
  exportName: string
): {
  keys: string[];
  parts: Array<{ kind: "value" | "spread"; key?: string; value: string }>;
  objectStart: number;
  objectEnd: number;
  importEnd: number;
};

export function transformCompactLocaleModule(
  source: string,
  fileName: string,
  exportName: string,
  canonicalKeys: string[]
): string;

export function createCompactI18nBuildPlugin(options?: { root?: string }): Plugin;

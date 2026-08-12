import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const CHECKER = resolve("scripts/check-production-data-integrity.cjs");
const CONFIG = resolve("config/production-data-integrity.json");
const SENTINEL = "ZENFLOW_TEST_FIXTURE_SENTINEL_7F4C9A2E";
const require = createRequire(import.meta.url);
type PdiVerificationHooks = {
  afterBundleInventoryCaptured?: (directory: string) => void;
  beforeBundleArtifactOpen?: (artifact: { directory: string; path: string }) => void;
  afterBundleAnalysis?: (directory: string) => void;
};

type PdiRunOptions = {
  root: string;
  mode: "all" | "diff" | "staged";
  configPath: string;
  bundleDirectories: string[];
  [key: symbol]: PdiVerificationHooks | undefined;
};

const CORE = require("../production-data-integrity/core.cjs") as {
  PDI_TEST_HOOKS: symbol;
  PDI_TEST_API: {
    sha256Bytes: (value: Buffer) => string;
  };
  runIntegrityCheck: (options: PdiRunOptions) => CheckerResult;
  validateConfig?: (config: Record<string, unknown>) => void;
  validateWaivers?: (waivers: unknown, now: Date) => void;
};
const CANONICAL_PDI_SCRIPTS = {
  "check:production-data-integrity": "node scripts/check-production-data-integrity.cjs --all",
  "check:production-data-integrity:diff": "node scripts/check-production-data-integrity.cjs --diff",
  "check:production-data-integrity:staged":
    "node scripts/check-production-data-integrity.cjs --staged",
  "check:production-data-integrity:bundle":
    "node scripts/check-production-data-integrity.cjs --all --bundle dist",
  "test:release-contracts": "scripts/__tests__/production-data-integrity-workflow.test.ts",
};

type CheckerFinding = {
  ruleId: string;
  path: string;
  fingerprint: string;
  baselined?: boolean;
  waived?: boolean;
};

type CheckerResult = {
  schemaVersion: string;
  status: "PASS" | "FAIL" | "ERROR";
  mode: "all" | "diff" | "staged";
  findings: CheckerFinding[];
  summary: {
    errors: number;
    warnings: number;
    baselined: number;
    waived: number;
  };
  error?: string;
};

function write(root: string, relativePath: string, content: string | Buffer): void {
  const target = join(root, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function fixture(
  files: Record<string, string | Buffer>,
  configure?: (config: Record<string, unknown>) => void
): string {
  const root = mkdtempSync(join(tmpdir(), "zenflow-pdi-"));
  const config = JSON.parse(readFileSync(CONFIG, "utf8")) as Record<string, unknown>;
  config.entrypoints = [...new Set([...(config.entrypoints as string[]), "src/main.ts"])];
  config.baselineFile = "config/production-data-integrity-baseline.json";
  config.waiversFile = "config/production-data-integrity-waivers.json";
  configure?.(config);

  write(root, "config/production-data-integrity.json", JSON.stringify(config, null, 2));
  write(
    root,
    "config/production-data-integrity-baseline.json",
    JSON.stringify({ schemaVersion: "1.0.0", entries: [] }, null, 2)
  );
  write(
    root,
    "config/production-data-integrity-waivers.json",
    JSON.stringify({ schemaVersion: "1.0.0", waivers: [] }, null, 2)
  );
  const contracts = Array.isArray(config.repositoryContracts)
    ? (config.repositoryContracts as Array<{ path: string; requiredStrings: string[] }>)
    : [];
  for (const contract of contracts) {
    if (existsSync(join(root, contract.path)) || files[contract.path] !== undefined) continue;
    const extension = contract.path.split(".").pop()?.toLowerCase();
    const content =
      contract.path === "package.json"
        ? JSON.stringify(
            { scripts: CANONICAL_PDI_SCRIPTS, contractMarkers: contract.requiredStrings },
            null,
            2
          )
        : contract.path === "scripts/check-production-data-integrity.cjs"
          ? readFileSync(resolve(contract.path), "utf8")
          : ["ts", "tsx", "js", "jsx", "mjs", "cjs"].includes(extension || "")
            ? `${contract.requiredStrings.map((value) => `// ${value}`).join("\n")}\n`
            : `${contract.requiredStrings.join("\n")}\n`;
    write(root, contract.path, content);
  }
  for (const [relativePath, content] of Object.entries(files)) write(root, relativePath, content);
  return root;
}

function runCoreWithHooks(
  root: string,
  hooks: PdiVerificationHooks,
  bundleDirectories = ["dist"]
): CheckerResult {
  const options = {
    root,
    mode: "all" as const,
    configPath: "config/production-data-integrity.json",
    bundleDirectories,
  } as PdiRunOptions;
  options[CORE.PDI_TEST_HOOKS] = hooks;
  return CORE.runIntegrityCheck(options);
}

function run(
  root: string,
  args: string[] = ["--all"]
): { status: number | null; report: CheckerResult; stderr: string } {
  const result = spawnSync(
    process.execPath,
    [
      CHECKER,
      ...args,
      "--json",
      ...(args.includes("--config") ? [] : ["--config", "config/production-data-integrity.json"]),
    ],
    { cwd: root, encoding: "utf8" }
  );
  let report: CheckerResult;
  try {
    report = JSON.parse(result.stdout) as CheckerResult;
  } catch {
    throw new Error(
      `checker did not return JSON\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
    );
  }
  return { status: result.status, report, stderr: result.stderr };
}

function expectRule(result: ReturnType<typeof run>, ruleId: string): CheckerFinding {
  expect(result.status, `${result.stderr}\n${JSON.stringify(result.report, null, 2)}`).toBe(1);
  expect(result.report.status).toBe("FAIL");
  const finding = result.report.findings.find((candidate) => candidate.ruleId === ruleId);
  expect(finding, JSON.stringify(result.report, null, 2)).toBeDefined();
  return finding!;
}

describe("production data integrity checker", () => {
  it("allows isolated test doubles, product content, honest fallbacks, and visual randomness", () => {
    const root = fixture({
      "src/main.ts": [
        "export const STARTER_TEMPLATES = [{ name: 'Drink water', icon: 'water', category: 'health' }];",
        "export function particles() { return Array.from({ length: 4 }, () => ({ x: Math.random(), y: Math.random() })); }",
        "export async function load() { try { return await fetch('/api').then(r => r.json()); } catch (error) { console.error(error); return []; } }",
      ].join("\n"),
      "src/lib/example.test.ts": [
        "import { vi } from 'vitest';",
        "vi.useFakeTimers();",
        "vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));",
        "export const fakeMood = { id: 'test-1', mood: 'good', date: '2026-01-01', timestamp: 1 };",
      ].join("\n"),
      "src/pages/__dev/Preview.ts":
        "export const sample = [{ id: 'demo-1', mood: 'good', date: '2026-01-01', timestamp: 1 }];",
      "src/test/fixtures/history.json": JSON.stringify([
        { id: "fixture-1", mood: "good", date: "2026-01-01", timestamp: 1 },
      ]),
      "supabase/migrations/test/seed.sql": "INSERT INTO moods(id, mood) VALUES ('test', 'good');",
    });

    const result = run(root);
    expect(result.status, JSON.stringify(result.report, null, 2)).toBe(0);
    expect(result.report.summary.errors).toBe(0);
  });

  it.each<{ name: string; rule: string; files: Record<string, string> }>([
    {
      name: "a test module imported through a barrel and alias",
      rule: "PDI001",
      files: {
        "src/main.ts": "import { records } from '@/domain'; console.log(records);",
        "src/domain/index.ts": "export { records } from '../test/fixture';",
        "src/test/fixture.ts":
          "export const records = [{ id: 'x', mood: 'good', date: '2026-01-01', timestamp: 1 }];",
      },
    },
    {
      name: "plausible history under a neutral variable name",
      rule: "PDI002",
      files: {
        "src/main.ts":
          "export const initialRecords = [{ id: crypto.randomUUID(), mood: 'good', note: 'Productive day', date: new Date().toISOString(), timestamp: Date.now() }];",
      },
    },
    {
      name: "a deceptive catch fallback",
      rule: "PDI003",
      files: {
        "src/main.ts":
          "export async function loadJournal() { try { return await api.load(); } catch (error) { return [{ id: crypto.randomUUID(), content: 'A calm day', date: new Date().toISOString(), timestamp: Date.now() }]; } }",
      },
    },
    {
      name: "a Promise.catch fallback",
      rule: "PDI003",
      files: {
        "src/main.ts":
          "export const loadMoods = () => api.load().catch(() => [{ id: 'fallback-1', mood: 'great', note: 'All good', date: '2026-07-09', timestamp: Date.now() }]);",
      },
    },
    {
      name: "synthetic records written to Dexie through spread and a nested helper",
      rule: "PDI004",
      files: {
        "src/main.ts":
          "const make = () => ({ id: crypto.randomUUID(), mood: 'good', note: 'Fine', date: new Date().toISOString(), timestamp: Date.now() }); async function save() { const base = make(); const row = { ...base, note: 'Great' }; await db.moods.put(row); } save();",
      },
    },
    {
      name: "synthetic records sent to Supabase",
      rule: "PDI004",
      files: {
        "src/main.ts":
          "const rows = [{ id: crypto.randomUUID(), mood: 'good', note: 'Fine', date: new Date().toISOString(), timestamp: Date.now() }]; supabase.from('moods').upsert(rows);",
      },
    },
    {
      name: "a stubbed success receipt",
      rule: "PDI005",
      files: {
        "src/main.ts":
          "export async function verifyPayment() { return { success: true, status: 'verified', receiptId: crypto.randomUUID(), verifiedAt: new Date().toISOString() }; }",
      },
    },
    {
      name: "production-default demo mode using the real namespace",
      rule: "PDI006",
      files: {
        "src/main.ts":
          "const demoEnabled = true; if (demoEnabled) storageSetRaw('zenflow-user-data', 'demo');",
      },
    },
    {
      name: "synthetic history sent to analytics",
      rule: "PDI007",
      files: {
        "src/main.ts":
          "const event = { id: crypto.randomUUID(), mood: 'great', note: 'Demo', date: new Date().toISOString(), timestamp: Date.now() }; analytics.track('mood', event);",
      },
    },
    {
      name: "production SQL seeding a user-history table",
      rule: "PDI008",
      files: {
        "src/main.ts": "export {};",
        "supabase/migrations/20260709000000_seed.sql":
          "INSERT INTO public.moods (id, user_id, mood, note) VALUES ('demo-1', 'user-1', 'great', 'Sample day');",
      },
    },
    {
      name: "fixture canary in a built artifact",
      rule: "PDI009",
      files: {
        "src/main.ts": "export {};",
        "dist/assets/app.js": `const leaked = '${SENTINEL}';`,
      },
    },
    {
      name: "fake release evidence without a command-bound proof",
      rule: "PDI011",
      files: {
        "src/main.ts": "export {};",
        "docs/release/fake-readiness.json": JSON.stringify({
          verificationStatus: "PASS",
          ready: true,
        }),
      },
    },
  ])("blocks $name", ({ files, rule }) => {
    expectRule(run(fixture(files)), rule);
  });

  it("follows literal dynamic imports, Vite globs, workers, and fixture JSON", () => {
    const cases: Record<string, string>[] = [
      {
        "src/main.ts": "void import('./test/fixture');",
        "src/test/fixture.ts": "export const value = 1;",
      },
      {
        "src/main.ts": "const modules = import.meta.glob('./test/*.ts'); console.log(modules);",
        "src/test/fixture.ts": "export const value = 1;",
      },
      {
        "src/main.ts": "new Worker(new URL('./test/fixture.ts', import.meta.url));",
        "src/test/fixture.ts": "self.postMessage('ready');",
      },
      {
        "src/main.ts": "import records from './test/records.json'; console.log(records);",
        "src/test/records.json": JSON.stringify([
          { id: "fixture-1", mood: "good", date: "2026-01-01", timestamp: 1 },
        ]),
      },
    ];

    for (const files of cases) expectRule(run(fixture(files)), "PDI001");
  });

  it("does not mistake a negated DEV branch or mixed runtime/type import for test isolation", () => {
    for (const main of [
      "if (!import.meta.env.DEV) { void import('./test/fixture'); }",
      "import runtimeValue, { type FixtureShape } from './test/fixture'; console.log(runtimeValue);",
    ]) {
      const root = fixture({
        "src/main.ts": main,
        "src/test/fixture.ts":
          "export default [{ id: 'fixture-1', mood: 'good', note: 'Fake', date: '2026-07-09', timestamp: 1 }]; export type FixtureShape = string;",
      });
      expectRule(run(root), "PDI001");
    }
  });

  it("blocks fully hardcoded plausible history without requiring a generated id or timestamp", () => {
    const root = fixture({
      "src/main.ts":
        "export const history = [{ id: 'entry-1', mood: 'good', note: 'A productive day', date: '2026-07-09', timestamp: 1783555200000 }];",
    });
    expectRule(run(root), "PDI002");
  });

  it("normalizes BOM and CRLF while keeping findings and ordering deterministic", () => {
    const root = fixture({
      "src/main.ts":
        "\uFEFFexport const rows = [{ id: crypto.randomUUID(), mood: 'good', note: 'Fine', date: new Date().toISOString(), timestamp: Date.now() }];\r\n",
    });
    const first = run(root);
    const second = run(root);
    expectRule(first, "PDI002");
    expect(second.report.findings).toEqual(first.report.findings);
    expect(first.report.findings.every((finding) => !finding.path.includes("\\"))).toBe(true);
  });

  it("keeps the fingerprint stable across identifier-only renames", () => {
    const root = fixture({
      "src/main.ts":
        "export const initialRecords = [{ id: crypto.randomUUID(), mood: 'good', note: 'Fine', date: new Date().toISOString(), timestamp: Date.now() }];",
    });
    const before = expectRule(run(root), "PDI002");
    write(
      root,
      "src/main.ts",
      "export const renamed = [{ id: crypto.randomUUID(), mood: 'good', note: 'Fine', date: new Date().toISOString(), timestamp: Date.now() }];"
    );
    const after = expectRule(run(root), "PDI002");
    expect(after.fingerprint).toBe(before.fingerprint);

    write(
      root,
      "src/main.ts",
      "export const renamed = [{ id: crypto.randomUUID(), mood: 'bad', note: 'Materially different invented history', date: new Date().toISOString(), timestamp: Date.now() }];"
    );
    const contentChanged = expectRule(run(root), "PDI002");
    expect(contentChanged.fingerprint).not.toBe(before.fingerprint);
  });

  it("reports an unreachable unclassified synthetic source as nonblocking PDI012", () => {
    const root = fixture({
      "src/main.ts": "export const value = 1;",
      "src/orphan.ts":
        "export const records = [{ id: crypto.randomUUID(), mood: 'good', note: 'Unclassified', date: new Date().toISOString(), timestamp: Date.now() }];",
    });

    const result = run(root);
    expect(result.status).toBe(0);
    expect(result.report.status).toBe("PASS");
    expect(result.report.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ ruleId: "PDI012", path: "src/orphan.ts" })])
    );
    expect(result.report.summary.warnings).toBe(1);
  });

  it("honors exact baselines but rejects stale broad or invalid waiver ledgers", () => {
    const root = fixture({
      "src/main.ts":
        "export const rows = [{ id: crypto.randomUUID(), mood: 'good', note: 'Fine', date: new Date().toISOString(), timestamp: Date.now() }];",
    });
    const finding = expectRule(run(root), "PDI002");
    write(
      root,
      "config/production-data-integrity-baseline.json",
      JSON.stringify({
        schemaVersion: "1.0.0",
        entries: [
          {
            ruleId: finding.ruleId,
            path: finding.path,
            fingerprint: finding.fingerprint,
            reason: "Legacy finding under human review",
          },
        ],
      })
    );
    const baselined = run(root);
    expect(baselined.status).toBe(0);
    expect(baselined.report.summary.baselined).toBe(1);

    write(
      root,
      "config/production-data-integrity-baseline.json",
      JSON.stringify({ schemaVersion: "1.0.0", allowedViolations: 1, entries: [] })
    );
    const broad = run(root);
    expect(broad.status).toBe(2);
    expect(broad.report.status).toBe("ERROR");

    write(
      root,
      "config/production-data-integrity-baseline.json",
      JSON.stringify({ schemaVersion: "1.0.0", entries: [] })
    );
    write(
      root,
      "config/production-data-integrity-waivers.json",
      JSON.stringify({
        schemaVersion: "1.0.0",
        waivers: [
          {
            id: "PDI-WAIVER-1",
            ruleId: "*",
            path: "src/**",
            fingerprint: finding.fingerprint,
            reason: "green CI",
            risk: "unknown",
            owner: "team",
            approvedBy: "codex",
            createdAt: "2026-07-09",
            expiresAt: "2025-07-09",
            trackingIssue: "none",
            removalCondition: "never",
          },
        ],
      })
    );
    const invalidWaiver = run(root);
    expect(invalidWaiver.status).toBe(2);
    expect(invalidWaiver.report.status).toBe("ERROR");
  });

  it("rejects PDI010 baselines and implausibly broad or weak human waivers", () => {
    const root = fixture({ "src/main.ts": "export const value = 1;" });
    write(
      root,
      "config/production-data-integrity-baseline.json",
      JSON.stringify({
        schemaVersion: "1.0.0",
        entries: [
          {
            ruleId: "PDI010",
            path: "package.json",
            fingerprint: "a".repeat(64),
            reason: "Enforcement cannot suppress itself",
          },
        ],
      })
    );
    expect(run(root).status).toBe(2);

    write(
      root,
      "config/production-data-integrity-baseline.json",
      JSON.stringify({ schemaVersion: "1.0.0", entries: [] })
    );
    write(
      root,
      "config/production-data-integrity-waivers.json",
      JSON.stringify({
        schemaVersion: "1.0.0",
        waivers: [
          {
            id: "PDI-WAIVER-9999",
            ruleId: "PDI002",
            path: "src/main.ts",
            fingerprint: "b".repeat(64),
            reason: "Only to keep the release green",
            risk: "fabricated history",
            owner: "x",
            approvedBy: "Y",
            createdAt: "2026-07-09",
            expiresAt: "9999-12-31",
            trackingIssue: "PDI-999",
            removalCondition: "when somebody remembers",
          },
        ],
      })
    );
    expect(run(root).status).toBe(2);
  });

  it.each([
    "entrypoints",
    "scanRoots",
    "bundleDirectories",
    "bundleSentinels",
    "repositoryContracts",
  ])("fails closed when canonical %s coverage is emptied", (field) => {
    const root = fixture({ "src/main.ts": "export const value = 1;" }, (config) => {
      config[field] = [];
    });
    const result = run(root);
    expect(result.status).toBe(2);
    expect(result.report.status).toBe("ERROR");
  });

  it("rejects non-empty substitutions that remove canonical coverage", () => {
    const mutations: Array<(config: Record<string, unknown>) => void> = [
      (config) => {
        config.entrypoints = (config.entrypoints as string[])
          .filter((value) => value !== "src/main.tsx")
          .concat("src/empty.ts");
      },
      (config) => {
        config.scanRoots = (config.scanRoots as string[])
          .filter((value) => value !== "public")
          .concat("docs");
      },
      (config) => {
        config.bundleSentinels = ["DIFFERENT_SENTINEL"];
      },
      (config) => {
        config.repositoryContracts = (config.repositoryContracts as Array<{ path: string }>).filter(
          (contract) => contract.path !== ".github/workflows/production-data-integrity.yml"
        );
      },
    ];
    for (const mutate of mutations) {
      const root = fixture({ "src/main.ts": "export const value = 1;" }, mutate);
      expect(run(root).status).toBe(2);
    }
  });

  it("rejects symlinked or oversized control JSON and invalid source encoding or syntax", () => {
    const symlinkRoot = fixture({ "src/main.ts": "export const value = 1;" });
    const external = join(mkdtempSync(join(tmpdir(), "zenflow-pdi-config-")), "config.json");
    writeFileSync(
      external,
      readFileSync(join(symlinkRoot, "config/production-data-integrity.json"))
    );
    writeFileSync(join(symlinkRoot, "config/production-data-integrity.json"), "{}");
    const configPath = join(symlinkRoot, "config/production-data-integrity.json");
    const replacement = `${configPath}.link`;
    symlinkSync(external, replacement);
    const symlinkResult = run(symlinkRoot, [
      "--all",
      "--config",
      "config/production-data-integrity.json.link",
    ]);
    expect(symlinkResult.status).toBe(2);
    expect(symlinkResult.report.error).toMatch(/symlink/i);

    const oversizedRoot = fixture({ "src/main.ts": "export const value = 1;" });
    const configText = readFileSync(
      join(oversizedRoot, "config/production-data-integrity.json"),
      "utf8"
    );
    writeFileSync(
      join(oversizedRoot, "config/production-data-integrity.json"),
      `${configText}${" ".repeat(2 * 1024 * 1024)}`
    );
    expect(run(oversizedRoot).status).toBe(2);

    const encodingRoot = fixture({ "src/main.ts": "export const value = 1;" });
    writeFileSync(
      join(encodingRoot, "src/main.ts"),
      Buffer.from([0x65, 0x78, 0x70, 0x6f, 0x72, 0x74, 0x20, 0xc3, 0x28])
    );
    expect(run(encodingRoot).status).toBe(2);

    const syntaxRoot = fixture({ "src/main.ts": "export const = ;" });
    expect(run(syntaxRoot).status).toBe(2);
  });

  it("covers public/native literal records, quoted user-table SQL, and generated evidence roots", () => {
    const cases: Array<{ path: string; content: string; rule: string }> = [
      {
        path: "public/history.json",
        content: JSON.stringify([
          { id: "demo-1", mood: "good", note: "Fake history", date: "2026-07-09", timestamp: 1 },
        ]),
        rule: "PDI002",
      },
      {
        path: "public/history.html",
        content:
          '<script type="application/json">{"id":"demo-1","mood":"good","note":"Fake history","date":"2026-07-09","timestamp":1}</script>',
        rule: "PDI002",
      },
      {
        path: "android/app/src/main/java/com/zenflow/FakeHistory.java",
        content:
          'Map.of("id", "demo-1", "mood", "good", "note", "Fake history", "date", "2026-07-09", "timestamp", 1);',
        rule: "PDI002",
      },
      {
        path: "ios/App/App/FakeHistory.swift",
        content:
          '["id": "demo-1", "mood": "good", "note": "Fake history", "date": "2026-07-09", "timestamp": 1]',
        rule: "PDI002",
      },
      {
        path: "src-tauri/src/fake_history.rs",
        content:
          'json!({"id":"demo-1","mood":"good","note":"Fake history","date":"2026-07-09","timestamp":1});',
        rule: "PDI002",
      },
      {
        path: "supabase/migrations/20260709000001_quoted.sql",
        content:
          'INSERT INTO "public"."moods" ("id", "user_id", "mood") VALUES (\'demo-1\', \'user-1\', \'good\');',
        rule: "PDI008",
      },
      {
        path: "output/fake-readiness.json",
        content: JSON.stringify({ ready: true }),
        rule: "PDI011",
      },
      {
        path: "artifacts/stale-proof.json",
        content: JSON.stringify({
          verificationStatus: "PASS",
          command: "npm test",
          exitCode: 0,
          timestamp: "2000-01-01T00:00:00.000Z",
          headSha: "deadbeef",
        }),
        rule: "PDI011",
      },
    ];
    for (const scenario of cases) {
      const root = fixture({
        "src/main.ts": "export const value = 1;",
        [scenario.path]: scenario.content,
      });
      const result = run(root);
      expect(result.status, `${scenario.path}\n${JSON.stringify(result.report, null, 2)}`).toBe(1);
      expect(result.report.findings, scenario.path).toEqual(
        expect.arrayContaining([expect.objectContaining({ ruleId: scenario.rule })])
      );
    }
  }, 15_000);

  it("accepts fresh evidence bound to the current exact HEAD or a verified artifact", () => {
    const root = fixture({ "src/main.ts": "export const value = 1;" });
    for (const args of [
      ["init"],
      ["config", "user.email", "pdi@example.invalid"],
      ["config", "user.name", "PDI Test"],
      ["add", "."],
      ["commit", "-m", "evidence baseline"],
    ])
      expect(spawnSync("git", args, { cwd: root, encoding: "utf8" }).status).toBe(0);
    const head = spawnSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).stdout.trim();
    write(
      root,
      "output/valid-proof.json",
      JSON.stringify({
        verificationStatus: "PASS",
        command: "npm run verify:proof",
        exitCode: 0,
        timestamp: new Date().toISOString(),
        headSha: head,
      })
    );
    const artifact = "verified release payload";
    write(root, "artifacts/release.bin", artifact);
    write(
      root,
      "output/valid-artifact-proof.json",
      JSON.stringify({
        verificationStatus: "PASS",
        command: "npm run verify:artifact",
        exitCode: 0,
        timestamp: new Date().toISOString(),
        artifactPath: "artifacts/release.bin",
        artifactSha256: createHash("sha256").update(artifact).digest("hex"),
      })
    );

    const result = run(root);
    expect(result.status, JSON.stringify(result.report, null, 2)).toBe(0);
    expect(result.report.findings).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ ruleId: "PDI011" })])
    );
  });

  it("scans source maps and fails when an explicitly requested bundle directory is absent", () => {
    const root = fixture({
      "src/main.ts": "export const value = 1;",
      "dist/assets/app.js.map": JSON.stringify({ version: 3, sourcesContent: [SENTINEL] }),
    });
    expectRule(run(root), "PDI009");

    const missing = run(root, ["--all", "--bundle", "missing-dist"]);
    expect(missing.status).toBe(2);
    expect(missing.report.status).toBe("ERROR");
  });

  it("returns exit 2 and an ERROR report for missing or malformed configuration", () => {
    const root = mkdtempSync(join(tmpdir(), "zenflow-pdi-error-"));
    const result = spawnSync(
      process.execPath,
      [CHECKER, "--all", "--json", "--config", "config/missing.json"],
      { cwd: root, encoding: "utf8" }
    );
    expect(result.status).toBe(2);
    const report = JSON.parse(result.stdout) as CheckerResult;
    expect(report.status).toBe("ERROR");
  });

  it("scopes diff and staged modes to changed paths without losing graph context", () => {
    const root = fixture({
      "src/main.ts": "export const value = 1;",
      "src/unchanged.ts":
        "export const rows = [{ id: crypto.randomUUID(), mood: 'good', note: 'Fine', date: new Date().toISOString(), timestamp: Date.now() }];",
    });
    for (const args of [
      ["init"],
      ["config", "user.email", "pdi@example.invalid"],
      ["config", "user.name", "PDI Test"],
      ["add", "."],
      ["commit", "-m", "baseline"],
    ]) {
      const git = spawnSync("git", args, { cwd: root, encoding: "utf8" });
      expect(git.status, git.stderr).toBe(0);
    }
    write(
      root,
      "src/main.ts",
      "export const rows = [{ id: crypto.randomUUID(), mood: 'great', note: 'Changed', date: new Date().toISOString(), timestamp: Date.now() }];"
    );

    const diff = run(root, ["--diff", "--base", "HEAD"]);
    expect(diff.report.mode).toBe("diff");
    expectRule(diff, "PDI002");

    expect(spawnSync("git", ["add", "src/main.ts"], { cwd: root }).status).toBe(0);
    const staged = run(root, ["--staged"]);
    expect(staged.report.mode).toBe("staged");
    expectRule(staged, "PDI002");
  });

  it("reads staged content from the Git index instead of a safe unstaged replacement", () => {
    const root = fixture({ "src/main.ts": "export const value = 1;" });
    for (const args of [
      ["init"],
      ["config", "user.email", "pdi@example.invalid"],
      ["config", "user.name", "PDI Test"],
      ["add", "."],
      ["commit", "-m", "baseline"],
    ]) {
      const git = spawnSync("git", args, { cwd: root, encoding: "utf8" });
      expect(git.status, git.stderr).toBe(0);
    }
    write(
      root,
      "src/main.ts",
      "export const history = [{ id: 'entry-1', mood: 'good', note: 'Staged fake', date: '2026-07-09', timestamp: 1783555200000 }];"
    );
    expect(spawnSync("git", ["add", "src/main.ts"], { cwd: root }).status).toBe(0);
    write(root, "src/main.ts", "export const value = 1;");

    expectRule(run(root, ["--staged"]), "PDI002");
  });

  it("uses the index snapshot for an empty staged set while explicit bundles stay live", () => {
    const root = fixture({ "src/main.ts": "export const value = 1;" });
    for (const args of [
      ["init"],
      ["config", "user.email", "pdi@example.invalid"],
      ["config", "user.name", "PDI Test"],
      ["add", "."],
      ["commit", "-m", "baseline"],
    ]) {
      const git = spawnSync("git", args, { cwd: root, encoding: "utf8" });
      expect(git.status, git.stderr).toBe(0);
    }

    write(root, "config/production-data-integrity.json", "{ malformed worktree config");
    write(root, "dist/assets/live-leak.txt", SENTINEL);

    const staged = run(root, ["--staged"]);
    expect(staged.status, JSON.stringify(staged.report, null, 2)).toBe(0);
    expect(staged.report.mode).toBe("staged");

    expectRule(run(root, ["--staged", "--bundle", "dist"]), "PDI009");
  });

  it("does not mark an unchanged exact baseline stale for an unrelated diff", () => {
    const root = fixture({
      "src/main.ts": "import './legacy'; export const value = 1;",
      "src/legacy.ts":
        "export const history = [{ id: 'legacy-1', mood: 'good', note: 'Known legacy risk', date: '2026-07-09', timestamp: 1783555200000 }];",
      "src/unrelated.ts": "export const unrelated = 1;",
    });
    const legacy = expectRule(run(root), "PDI002");
    write(
      root,
      "config/production-data-integrity-baseline.json",
      JSON.stringify({
        schemaVersion: "1.0.0",
        entries: [
          {
            ruleId: legacy.ruleId,
            path: legacy.path,
            fingerprint: legacy.fingerprint,
            reason: "Exact legacy risk pending owner removal",
          },
        ],
      })
    );
    for (const args of [
      ["init"],
      ["config", "user.email", "pdi@example.invalid"],
      ["config", "user.name", "PDI Test"],
      ["add", "."],
      ["commit", "-m", "baseline"],
    ])
      expect(spawnSync("git", args, { cwd: root, encoding: "utf8" }).status).toBe(0);
    write(root, "src/unrelated.ts", "export const unrelated = 2;");

    const result = run(root, ["--diff", "--base", "HEAD"]);
    expect(result.status, JSON.stringify(result.report, null, 2)).toBe(0);
    expect(result.report.findings).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ ruleId: "PDI010" })])
    );
  });

  it.each([
    {
      name: "numeric focus history",
      rule: "PDI002",
      files: {
        "src/main.ts":
          "export const x=[{id:'focus-1',duration:25,date:'2026-07-09',completedAt:1783555200000,status:'completed'}];",
      },
    },
    {
      name: "object-valued habit entries",
      rule: "PDI002",
      files: {
        "src/main.ts":
          "export const x=[{id:'habit-1',entries:{'2026-07-09':{value:2}},createdAt:1783555200000,date:'2026-07-09'}];",
      },
    },
    {
      name: "shorthand mood history",
      rule: "PDI002",
      files: {
        "src/main.ts":
          "const id='entry-1';const mood='good';const note='Invented day';const date='2026-07-09';const timestamp=1783555200000;const record={id,mood,note,date,timestamp};db.moods.put(record);",
      },
    },
    {
      name: "shorthand mood history persisted to Dexie",
      rule: "PDI004",
      files: {
        "src/main.ts":
          "const id='entry-1';const mood='good';const note='Invented day';const date='2026-07-09';const timestamp=1783555200000;const record={id,mood,note,date,timestamp};db.moods.put(record);",
      },
    },
    {
      name: "verified zero-count failure fallback",
      rule: "PDI003",
      files: {
        "src/main.ts":
          "export async function loadSyncIntegrity(){try{return await inspectRemoteIntegrity();}catch(error){return {status:'verified',localCounts:{moods:0,habits:0,focusSessions:0},remoteCounts:{moods:0,habits:0,focusSessions:0}};}}",
      },
    },
    {
      name: "fixed verification receipt",
      rule: "PDI005",
      files: {
        "src/main.ts":
          "export async function verifyReceipt(){return {success:true,status:'verified',receiptId:'receipt-fixed-001',verifiedAt:'2026-07-09T00:00:00.000Z'};}",
      },
    },
  ])("blocks $name", ({ files, rule }) => {
    expectRule(run(fixture(files)), rule);
  });

  it.each<{ name: string; rule: string; files: Record<string, string> }>([
    {
      name: "shipped public fixture",
      rule: "PDI002",
      files: {
        "src/main.ts": "export {};",
        "public/fixtures/history.json":
          '[{"id":"mood-1","mood":"good","note":"Invented public history","date":"2026-07-09","timestamp":1783555200000}]',
      },
    },
    {
      name: "nested iOS Swift history",
      rule: "PDI002",
      files: {
        "src/main.ts": "export {};",
        "ios/App/App/Bridge/FakeHistory.swift":
          'let record:[String:Any]=["id":"mood-1","mood":"good","note":"Invented native history","date":"2026-07-09","timestamp":1783555200000]',
      },
    },
    {
      name: "literal static-asset URL",
      rule: "PDI001",
      files: {
        "src/main.ts": "export const u=new URL('./test/records.json',import.meta.url);",
        "src/test/records.json": '[{"id":"fixture-1"}]',
      },
    },
    {
      name: "Vite config fixture import",
      rule: "PDI001",
      files: {
        "src/main.ts": "export {};",
        "vite.config.ts": "import {records} from './src/test/fixture';export default {records};",
        "src/test/fixture.ts": "export const records=[1];",
      },
    },
    {
      name: "brace-expanded Vite glob",
      rule: "PDI001",
      files: {
        "src/main.ts": "const modules=import.meta.glob('./test/*.{ts,tsx}');console.log(modules);",
        "src/test/fixture.ts": "export const fixture=1;",
      },
    },
  ])("covers $name", ({ files, rule }) => {
    expectRule(run(fixture(files)), rule);
  });

  it.each([
    ["output/evidence.json", JSON.stringify({ release: { ready: true } })],
    ["output/readiness.json", JSON.stringify({ status: "PASS" })],
    ["output/release/nested.json", JSON.stringify({ ready: true })],
  ])("blocks unsupported positive release evidence in %s", (evidencePath, content) => {
    const root = fixture({ "src/main.ts": "export {};", [evidencePath]: content });
    expectRule(run(root), "PDI011");
  });

  it("binds release proof to its positive claim instead of accepting an unrelated sibling", () => {
    const artifact = "unrelated artifact";
    const artifactPath = "artifacts/unrelated.bin";
    const root = fixture({
      "src/main.ts": "export {};",
      [artifactPath]: artifact,
    });
    write(
      root,
      "output/evidence.json",
      JSON.stringify({
        release: { ready: true },
        unrelated: {
          command: "verify unrelated artifact",
          exitCode: 0,
          timestamp: new Date().toISOString(),
          artifactPath,
          artifactSha256: createHash("sha256").update(artifact).digest("hex"),
        },
      })
    );

    expectRule(run(root), "PDI011");

    write(
      root,
      "output/evidence.json",
      JSON.stringify({
        release: { ready: true },
        proof: {
          command: "verify unrelated artifact",
          exitCode: 0,
          timestamp: new Date().toISOString(),
          artifactPath,
          artifactSha256: createHash("sha256").update(artifact).digest("hex"),
        },
      })
    );
    expectRule(run(root), "PDI011");

    write(
      root,
      "output/evidence.json",
      JSON.stringify({
        release: {
          ready: true,
          proof: {
            command: "verify release artifact",
            exitCode: 0,
            timestamp: new Date().toISOString(),
            artifactPath,
            artifactSha256: createHash("sha256").update(artifact).digest("hex"),
          },
        },
      })
    );
    const linked = run(root);
    expect(linked.status, JSON.stringify(linked.report, null, 2)).toBe(0);
    expect(linked.report.findings).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ ruleId: "PDI011" })])
    );

    write(
      root,
      "output/evidence.json",
      JSON.stringify({
        release: {
          ready: true,
          proof: {
            command: "verify release artifact",
            exitCode: 0,
            timestamp: new Date().toISOString(),
            artifactPath,
            artifactSha256: "0".repeat(64),
          },
        },
      })
    );
    expectRule(run(root), "PDI011");
  });

  it("scans readiness packets one directory below output without traversing arbitrary output trees", () => {
    const root = fixture({
      "src/main.ts": "export {};",
      "output/journal-photo-proof/readiness.json": JSON.stringify({ release: { ready: true } }),
    });
    expectRule(run(root), "PDI011");
  });

  it.each<{ name: string; path: string; content: string }>([
    {
      name: "CapApp Swift package history",
      path: "ios/App/CapApp-SPM/Sources/CapApp/FakeHistory.swift",
      content:
        'let record:[String:Any]=["id":"mood-1","mood":"good","note":"Invented package history","date":"2026-07-09","timestamp":1783555200000]',
    },
    {
      name: "Tauri build-script history",
      path: "src-tauri/build.rs",
      content:
        'const RECORD: &str = r#"{"id":"mood-1","mood":"good","note":"Invented build history","date":"2026-07-09","timestamp":1783555200000}"#;',
    },
  ])("blocks shipped native history from $name", ({ path: nativePath, content }) => {
    const root = fixture({ "src/main.ts": "export {};", [nativePath]: content });
    expectRule(run(root), "PDI002");
  });

  it("allows type-only re-exports and an explicit disabled demo marker", () => {
    const root = fixture({
      "src/main.ts": [
        "export { type FixtureType } from './test/fixture';",
        "function storageSetRaw(_key: string, _value: string) {}",
        "storageSetRaw('zenflow-demo-mode', 'false');",
      ].join("\n"),
      "src/test/fixture.ts": "export type FixtureType = { id: string };",
    });
    const result = run(root);
    expect(result.status, JSON.stringify(result.report, null, 2)).toBe(0);
    expect(result.report.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "PDI001" }),
        expect.objectContaining({ ruleId: "PDI006" }),
      ])
    );
  });

  it("keeps a mixed runtime/type re-export in the production graph", () => {
    const root = fixture({
      "src/main.ts": "export { type FixtureType, fixtureRuntime } from './test/fixture';",
      "src/test/fixture.ts": [
        "export type FixtureType = { id: string };",
        "export const fixtureRuntime = 1;",
      ].join("\n"),
    });
    expectRule(run(root), "PDI001");
  });

  it("rejects empty explicit bundles and scans text artifacts for the bundle canary", () => {
    const emptyRoot = fixture({ "src/main.ts": "export {};" });
    mkdirSync(join(emptyRoot, "dist"), { recursive: true });
    const empty = run(emptyRoot, ["--all", "--bundle", "dist"]);
    expect(empty.status).toBe(2);
    expect(empty.report.error).toMatch(/empty|readable text/i);

    const canaryRoot = fixture({
      "src/main.ts": "export {};",
      "dist/assets/leak.txt": SENTINEL,
    });
    expectRule(run(canaryRoot, ["--all", "--bundle", "dist"]), "PDI009");
  });

  it("fails closed on Finder/FileProvider duplicate bundle paths before reading their contents", () => {
    const duplicateFileRoot = fixture({
      "src/main.ts": "export {};",
      "dist/assets/app.js": "export const app = true;",
      "dist/assets/app 2.js": Buffer.from([0xc3, 0x28]),
      "dist/version2.json": JSON.stringify({ allowed: true }),
    });
    const duplicateFile = run(duplicateFileRoot, ["--all", "--bundle", "dist"]);

    expect(duplicateFile.status).toBe(2);
    expect(duplicateFile.report.status).toBe("ERROR");
    expect(duplicateFile.report.error).toMatch(/duplicate.*artifact.*assets\/app 2\.js/i);
    expect(duplicateFile.report.error).not.toMatch(/UTF-8|byte limit/i);

    const duplicateDirectoryRoot = fixture({
      "src/main.ts": "export {};",
      "dist/assets/app.js": "export const app = true;",
      "dist/assets/chunk 2/poison.js": "export const poison = true;",
    });
    const duplicateDirectory = run(duplicateDirectoryRoot, ["--all", "--bundle", "dist"]);

    expect(duplicateDirectory.status).toBe(2);
    expect(duplicateDirectory.report.status).toBe("ERROR");
    expect(duplicateDirectory.report.error).toMatch(/duplicate.*artifact.*assets\/chunk 2/i);
  });

  it("rejects a symlinked explicit bundle root without traversing it", () => {
    const root = fixture({ "src/main.ts": "export {};" });
    const external = mkdtempSync(join(tmpdir(), "zenflow-pdi-external-bundle-"));
    write(external, "assets/app.js", "export const outside = true;");
    symlinkSync(external, join(root, "dist"), "dir");

    try {
      const result = run(root, ["--all", "--bundle", "dist"]);
      expect(result.status).toBe(2);
      expect(result.report.status).toBe("ERROR");
      expect(result.report.error).toMatch(/bundle directory.*symlink/i);
    } finally {
      rmSync(external, { recursive: true, force: true });
    }
  });

  it("detects a bundle inventory change after scanning instead of reporting PASS", () => {
    const root = fixture({
      "src/main.ts": "export {};",
      "dist/assets/app.js": "export const app = true;",
      "dist/version2.json": JSON.stringify({ allowed: true }),
    });

    expect(() =>
      runCoreWithHooks(root, {
        afterBundleInventoryCaptured: (directory) => {
          expect(directory).toBe("dist");
          write(root, "dist/assets/late.js", "export const late = true;");
        },
      })
    ).toThrow(/bundle artifact inventory changed/i);
  });

  it("detects a mutation injected after bundle analysis", () => {
    const root = fixture({
      "src/main.ts": "export {};",
      "dist/assets/app.js": "export const app = true;",
    });

    expect(() =>
      runCoreWithHooks(root, {
        afterBundleAnalysis: (directory) => {
          expect(directory).toBe("dist");
          write(root, "dist/assets/late-after-analysis.js", "export const late = true;");
        },
      })
    ).toThrow(/bundle artifact inventory changed/i);
  });

  it("uses descriptor-bound reads and fails before following a raced bundle symlink", () => {
    const root = fixture({
      "src/main.ts": "export {};",
      "dist/assets/app.js": "export const app = true;",
    });
    const external = mkdtempSync(join(tmpdir(), "zenflow-pdi-raced-artifact-"));
    write(external, "external.js", "export const outside = 'must not be read';");
    let swapped = false;

    try {
      expect(() =>
        runCoreWithHooks(root, {
          beforeBundleArtifactOpen: ({ path }) => {
            if (swapped || path !== "dist/assets/app.js") return;
            swapped = true;
            rmSync(join(root, path), { force: true });
            symlinkSync(join(external, "external.js"), join(root, path), "file");
          },
        })
      ).toThrow(/bundle artifact.*(?:symbolic link|without following links|inventory changed)/i);
      expect(swapped).toBe(true);
    } finally {
      rmSync(external, { recursive: true, force: true });
    }
  });

  it("bounds explicit bundle roots, directory fan-out, and aggregate bytes", () => {
    const tooManyRoots = fixture({ "src/main.ts": "export {};" });
    const rootNames = Array.from({ length: 5 }, (_, index) => `bundle-${index + 1}`);
    for (const name of rootNames) write(tooManyRoots, `${name}/app.js`, "export {};");
    const rootsResult = run(tooManyRoots, [
      "--all",
      ...rootNames.flatMap((name) => ["--bundle", name]),
    ]);
    expect(rootsResult.status).toBe(2);
    expect(rootsResult.report.error).toMatch(/bundle root count/i);

    const directoryFanout = fixture({
      "src/main.ts": "export {};",
      "dist/app.js": "export {};",
    });
    for (let index = 0; index < 2_049; index += 1) {
      mkdirSync(join(directoryFanout, "dist", `empty-${index}`));
    }
    const fanoutResult = run(directoryFanout, ["--all", "--bundle", "dist"]);
    expect(fanoutResult.status).toBe(2);
    expect(fanoutResult.report.error).toMatch(/bundle directory count/i);

    const aggregateBytes = fixture({
      "src/main.ts": "export {};",
      "dist/app.js": "export {};",
    });
    for (let index = 0; index < 9; index += 1) {
      const filePath = join(aggregateBytes, "dist", `large-${index}.bin`);
      write(aggregateBytes, `dist/large-${index}.bin`, "");
      truncateSync(filePath, 8 * 1024 * 1024);
    }
    const bytesResult = run(aggregateBytes, ["--all", "--bundle", "dist"]);
    expect(bytesResult.status).toBe(2);
    expect(bytesResult.report.error).toMatch(/aggregate byte limit/i);
  }, 20_000);

  it("rejects non-NFC bundle names instead of normalizing two dirents onto one path", () => {
    const root = fixture({
      "src/main.ts": "export {};",
      "dist/assets/app.js": "export const app = true;",
      ["dist/assets/cafe\u0301.js"]: "export const decomposed = true;",
    });

    const result = run(root, ["--all", "--bundle", "dist"]);
    expect(result.status).toBe(2);
    expect(result.report.error).toMatch(/NFC normalization|canonically equivalent/i);
  });

  it("rejects a non-NFC explicit bundle root before normalizing its spelling", () => {
    const decomposedRoot = "bundle-cafe\u0301";
    const root = fixture({
      "src/main.ts": "export {};",
      [`${decomposedRoot}/app.js`]: "export {};",
    });

    const result = run(root, ["--all", "--bundle", decomposedRoot]);
    expect(result.status).toBe(2);
    expect(result.report.error).toMatch(/bundle root.*NFC normalization/i);
  });

  it("hashes raw bundle bytes without lossy UTF-8 string coercion", () => {
    expect(CORE.PDI_TEST_API.sha256Bytes(Buffer.from([0x80]))).not.toBe(
      CORE.PDI_TEST_API.sha256Bytes(Buffer.from([0x81])),
    );
  });

  it("bounds CLI error output for adversarially long bundle paths", () => {
    const root = fixture({ "src/main.ts": "export {};" });
    const result = run(root, ["--all", "--bundle", `missing-${"x".repeat(10_000)}`]);

    expect(result.status).toBe(2);
    expect(result.report.status).toBe("ERROR");
    expect(result.report.error?.length).toBeLessThanOrEqual(1_024);
    expect(result.report.error).toMatch(/sha256:/i);
  });

  it("allows ordinary numeric names and a stable clean explicit bundle", () => {
    const root = fixture({
      "src/main.ts": "export {};",
      "dist/assets/app.js": "export const app = true;",
      "dist/version2.json": JSON.stringify({ allowed: true }),
    });

    const result = run(root, ["--all", "--bundle", "dist"]);
    expect(result.status, JSON.stringify(result.report, null, 2)).toBe(0);
    expect(result.report.status).toBe("PASS");
  });

  it("allows T168-style parameterized operational DML inside a function definition", () => {
    const root = fixture({
      "src/main.ts": "export {};",
      "supabase/migrations/20260709000009_operational_rpc.sql": [
        "CREATE OR REPLACE FUNCTION public.apply_mood_projection(p_owner uuid, p_after jsonb)",
        "RETURNS void",
        "LANGUAGE plpgsql",
        "SECURITY DEFINER",
        "SET search_path = ''",
        "AS $function$",
        "DECLARE",
        "  v_mood public.moods%ROWTYPE;",
        "BEGIN",
        "  v_mood := pg_catalog.jsonb_populate_record(NULL::public.moods, p_after || pg_catalog.jsonb_build_object('user_id', p_owner));",
        "  INSERT INTO public.moods (id, user_id, mood, note, date, timestamp, updated_at)",
        "  VALUES (v_mood.id, p_owner, v_mood.mood, v_mood.note, v_mood.date, v_mood.timestamp, v_mood.updated_at)",
        "  ON CONFLICT (id) DO UPDATE SET mood = EXCLUDED.mood, note = EXCLUDED.note, updated_at = EXCLUDED.updated_at",
        "  WHERE public.moods.user_id = p_owner;",
        "END;",
        "$function$;",
      ].join("\n"),
    });

    const result = run(root);
    expect(result.status, JSON.stringify(result.report, null, 2)).toBe(0);
    expect(result.report.status).toBe("PASS");
  });

  it("allows parameterized operational DML inside an untagged dollar-quoted function", () => {
    const root = fixture({
      "src/main.ts": "export {};",
      "supabase/migrations/20260709000009_untagged_operational_rpc.sql": [
        "CREATE OR REPLACE FUNCTION public.insert_mood_projection(p_id uuid, p_owner uuid, p_mood text, p_note text, p_date date, p_timestamp bigint)",
        "RETURNS void",
        "LANGUAGE plpgsql",
        "AS $$",
        "BEGIN",
        "  INSERT INTO public.moods (id, user_id, mood, note, date, timestamp, updated_at)",
        "  VALUES (p_id, p_owner, p_mood, p_note, p_date, p_timestamp, p_timestamp);",
        "END;",
        "$$;",
      ].join("\n"),
    });

    const result = run(root);
    expect(result.status, JSON.stringify(result.report, null, 2)).toBe(0);
    expect(result.report.status).toBe("PASS");
  });

  it("allows parameterized operational DML inside a tagged procedure", () => {
    const root = fixture({
      "src/main.ts": "export {};",
      "supabase/migrations/20260709000009_operational_procedure.sql": [
        "CREATE OR REPLACE PROCEDURE public.insert_mood_projection(p_id uuid, p_owner uuid, p_mood text, p_note text, p_date date, p_timestamp bigint)",
        "LANGUAGE plpgsql",
        "AS $procedure$",
        "BEGIN",
        "  INSERT INTO public.moods (id, user_id, mood, note, date, timestamp, updated_at)",
        "  VALUES (p_id, p_owner, p_mood, p_note, p_date, p_timestamp, p_timestamp);",
        "END;",
        "$procedure$;",
      ].join("\n"),
    });

    const result = run(root);
    expect(result.status, JSON.stringify(result.report, null, 2)).toBe(0);
    expect(result.report.status).toBe("PASS");
  });

  it("allows positional SQL parameters inside a stored function", () => {
    const root = fixture({
      "src/main.ts": "export {};",
      "supabase/migrations/20260709000009_positional_operational_rpc.sql": [
        "CREATE OR REPLACE FUNCTION public.insert_mood_projection(uuid, uuid, text, text, date, bigint)",
        "RETURNS void",
        "LANGUAGE sql",
        "AS $sql$",
        "  INSERT INTO public.moods (id, user_id, mood, note, date, timestamp, updated_at)",
        "  VALUES ($1, $2, $3, $4, $5, $6, $6);",
        "$sql$;",
      ].join("\n"),
    });

    const result = run(root);
    expect(result.status, JSON.stringify(result.report, null, 2)).toBe(0);
    expect(result.report.status).toBe("PASS");
  });

  it("blocks a hardcoded owner identity inside an otherwise parameterized routine", () => {
    const root = fixture({
      "src/main.ts": "export {};",
      "supabase/migrations/20260709000009_fixed_owner_rpc.sql": [
        "CREATE OR REPLACE FUNCTION public.insert_mood_projection(p_id uuid, p_mood text, p_note text, p_date date, p_timestamp bigint)",
        "RETURNS void LANGUAGE plpgsql AS $body$",
        "BEGIN",
        "  INSERT INTO public.moods (id, user_id, mood, note, date, timestamp, updated_at)",
        "  VALUES (p_id, '07c6a8bc-c28e-4ad4-9d04-a0a2dcdb1b62'::uuid, p_mood, p_note, p_date, p_timestamp, p_timestamp);",
        "END;",
        "$body$;",
      ].join("\n"),
    });

    expectRule(run(root), "PDI008");
  });

  it("allows the authenticated runtime owner inside a parameterized routine", () => {
    const root = fixture({
      "src/main.ts": "export {};",
      "supabase/migrations/20260709000009_authenticated_owner_rpc.sql": [
        "CREATE OR REPLACE FUNCTION public.insert_mood_projection(p_id uuid, p_mood text, p_note text, p_date date, p_timestamp bigint)",
        "RETURNS void LANGUAGE plpgsql AS $body$",
        "BEGIN",
        "  INSERT INTO public.moods (id, user_id, mood, note, date, timestamp, updated_at)",
        "  VALUES (p_id, auth.uid(), p_mood, p_note, p_date, p_timestamp, p_timestamp);",
        "END;",
        "$body$;",
      ].join("\n"),
    });

    const result = run(root);
    expect(result.status, JSON.stringify(result.report, null, 2)).toBe(0);
    expect(result.report.status).toBe("PASS");
  });

  it("blocks hardcoded synthetic user history inside a function definition", () => {
    const root = fixture({
      "src/main.ts": "export {};",
      "supabase/migrations/20260709000009_synthetic_rpc.sql": [
        "CREATE OR REPLACE FUNCTION public.create_default_mood(p_owner uuid)",
        "RETURNS void",
        "LANGUAGE plpgsql",
        "SECURITY DEFINER",
        "SET search_path = ''",
        "AS $function$",
        "BEGIN",
        "  INSERT INTO public.moods (id, user_id, mood, note, date, timestamp, updated_at)",
        "  VALUES (extensions.gen_random_uuid(), p_owner, 'good', 'A fabricated entry', DATE '2026-07-09', 1783562400000, 1783562400000);",
        "END;",
        "$function$;",
      ].join("\n"),
    });

    expectRule(run(root), "PDI008");
  });

  it("blocks top-level user-data DML adjacent to a safe function", () => {
    const root = fixture({
      "src/main.ts": "export {};",
      "supabase/migrations/20260709000009_adjacent_top_level_seed.sql": [
        "CREATE OR REPLACE FUNCTION public.insert_mood_projection(p_id uuid, p_owner uuid, p_mood text, p_note text, p_date date, p_timestamp bigint)",
        "RETURNS void LANGUAGE plpgsql AS $body$",
        "BEGIN",
        "  INSERT INTO public.moods (id, user_id, mood, note, date, timestamp, updated_at)",
        "  VALUES (p_id, p_owner, p_mood, p_note, p_date, p_timestamp, p_timestamp);",
        "END;",
        "$body$;",
        "INSERT INTO public.moods (id, user_id, mood, note, date, timestamp, updated_at)",
        "VALUES ('mood-1', 'user-1', 'good', 'fabricated', DATE '2026-07-09', 1783562400000, 1783562400000);",
      ].join("\n"),
    });

    expectRule(run(root), "PDI008");
  });

  it("blocks dynamic SQL that writes hardcoded user history inside a function", () => {
    const root = fixture({
      "src/main.ts": "export {};",
      "supabase/migrations/20260709000009_dynamic_seed_rpc.sql": [
        "CREATE OR REPLACE FUNCTION public.create_dynamic_default_mood()",
        "RETURNS void LANGUAGE plpgsql AS $body$",
        "BEGIN",
        "  EXECUTE 'INSERT INTO public.moods (id, user_id, mood, note, date, timestamp, updated_at) VALUES (''mood-1'', ''user-1'', ''good'', ''fabricated'', DATE ''2026-07-09'', 1783562400000, 1783562400000)';",
        "END;",
        "$body$;",
      ].join("\n"),
    });

    expectRule(run(root), "PDI008");
  });

  it("fails closed for user-data DML in a single-quoted function body", () => {
    const root = fixture({
      "src/main.ts": "export {};",
      "supabase/migrations/20260709000009_single_quoted_seed_rpc.sql": [
        "CREATE OR REPLACE FUNCTION public.create_single_quoted_default_mood()",
        "RETURNS void LANGUAGE plpgsql AS '",
        "BEGIN",
        "  INSERT INTO public.moods (id, user_id, mood, note, date, timestamp, updated_at)",
        "  VALUES (''mood-1'', ''user-1'', ''good'', ''fabricated'', DATE ''2026-07-09'', 1783562400000, 1783562400000);",
        "END;",
        "';",
      ].join("\n"),
    });

    expectRule(run(root), "PDI008");
  });

  it("fails closed for a multi-row VALUES insert inside a stored routine", () => {
    const root = fixture({
      "src/main.ts": "export {};",
      "supabase/migrations/20260709000009_multi_row_rpc.sql": [
        "CREATE OR REPLACE FUNCTION public.insert_moods(p_id uuid, p_owner uuid, p_mood text, p_note text, p_date date, p_timestamp bigint)",
        "RETURNS void LANGUAGE plpgsql AS $body$",
        "BEGIN",
        "  INSERT INTO public.moods (id, user_id, mood, note, date, timestamp, updated_at)",
        "  VALUES (p_id, p_owner, p_mood, p_note, p_date, p_timestamp, p_timestamp),",
        "         ('mood-2', 'user-2', 'good', 'fabricated', DATE '2026-07-09', 1783562400000, 1783562400000);",
        "END;",
        "$body$;",
      ].join("\n"),
    });

    expectRule(run(root), "PDI008");
  });

  it("blocks a dollar-quoted hardcoded history value inside a parameterized routine", () => {
    const root = fixture({
      "src/main.ts": "export {};",
      "supabase/migrations/20260709000009_dollar_value_rpc.sql": [
        "CREATE OR REPLACE FUNCTION public.insert_mood(p_id uuid, p_owner uuid, p_note text, p_date date, p_timestamp bigint)",
        "RETURNS void LANGUAGE plpgsql AS $body$",
        "BEGIN",
        "  INSERT INTO public.moods (id, user_id, mood, note, date, timestamp, updated_at)",
        "  VALUES (p_id, p_owner, $mood$good$mood$, p_note, p_date, p_timestamp, p_timestamp);",
        "END;",
        "$body$;",
      ].join("\n"),
    });

    expectRule(run(root), "PDI008");
  });

  it("blocks a hardcoded time expression inside an otherwise parameterized routine", () => {
    const root = fixture({
      "src/main.ts": "export {};",
      "supabase/migrations/20260709000009_constant_time_rpc.sql": [
        "CREATE OR REPLACE FUNCTION public.insert_mood(p_id uuid, p_owner uuid, p_mood text, p_note text, p_timestamp bigint)",
        "RETURNS void LANGUAGE plpgsql AS $body$",
        "BEGIN",
        "  INSERT INTO public.moods (id, user_id, mood, note, date, timestamp, updated_at)",
        "  VALUES (p_id, p_owner, p_mood, p_note, make_date(2026, 7, 9), p_timestamp, p_timestamp);",
        "END;",
        "$body$;",
      ].join("\n"),
    });

    expectRule(run(root), "PDI008");
  });

  it("blocks a hardcoded history fallback mixed with a runtime parameter", () => {
    const root = fixture({
      "src/main.ts": "export {};",
      "supabase/migrations/20260709000009_history_fallback_rpc.sql": [
        "CREATE OR REPLACE FUNCTION public.insert_mood(p_id uuid, p_owner uuid, p_mood text, p_note text, p_date date, p_timestamp bigint)",
        "RETURNS void LANGUAGE plpgsql AS $body$",
        "BEGIN",
        "  INSERT INTO public.moods (id, user_id, mood, note, date, timestamp, updated_at)",
        "  VALUES (p_id, p_owner, COALESCE(p_mood, 'good'), p_note, p_date, p_timestamp, p_timestamp);",
        "END;",
        "$body$;",
      ].join("\n"),
    });

    expectRule(run(root), "PDI008");
  });

  it("fails closed when a stored-routine body is unterminated", () => {
    const root = fixture({
      "src/main.ts": "export {};",
      "supabase/migrations/20260709000009_unterminated_rpc.sql": [
        "CREATE OR REPLACE FUNCTION public.insert_mood_projection(p_id uuid, p_owner uuid, p_mood text, p_note text, p_date date, p_timestamp bigint)",
        "RETURNS void LANGUAGE plpgsql AS $body$",
        "BEGIN",
        "  INSERT INTO public.moods (id, user_id, mood, note, date, timestamp, updated_at)",
        "  VALUES (p_id, p_owner, p_mood, p_note, p_date, p_timestamp, p_timestamp);",
        "END;",
      ].join("\n"),
    });

    expectRule(run(root), "PDI008");
  });

  it("ignores user-data DML words that occur only in comments or ordinary SQL strings", () => {
    const root = fixture({
      "src/main.ts": "export {};",
      "supabase/migrations/20260709000009_sql_text_only.sql": [
        "-- INSERT INTO public.moods (id) VALUES ('comment-only');",
        "/* COPY public.moods FROM STDIN; */",
        "SELECT 'INSERT INTO public.moods (id) VALUES (''string-only'')'::text;",
      ].join("\n"),
    });

    const result = run(root);
    expect(result.status, JSON.stringify(result.report, null, 2)).toBe(0);
    expect(result.report.status).toBe("PASS");
  });

  it("blocks user-data DML inside an anonymous DO block", () => {
    const root = fixture({
      "src/main.ts": "export {};",
      "supabase/migrations/20260709000009_anonymous_seed.sql": [
        "DO LANGUAGE plpgsql $block$",
        "BEGIN",
        "  INSERT INTO public.moods (id, user_id, mood, note, date, timestamp, updated_at)",
        "  VALUES ('mood-1', 'user-1', 'good', 'fabricated', DATE '2026-07-09', 1783562400000, 1783562400000);",
        "END;",
        "$block$;",
      ].join("\n"),
    });

    expectRule(run(root), "PDI008");
  });

  it.each([
    "COPY public.moods (id, user_id, mood) FROM STDIN;",
    "MERGE INTO public.moods AS target USING source_moods AS source ON target.id = source.id WHEN NOT MATCHED THEN INSERT (id, user_id, mood) VALUES (source.id, source.user_id, source.mood);",
  ])("blocks non-INSERT user-data writes inside stored routines", (statement) => {
    const root = fixture({
      "src/main.ts": "export {};",
      "supabase/migrations/20260709000009_non_insert_routine_write.sql": [
        "CREATE OR REPLACE FUNCTION public.write_mood()",
        "RETURNS void LANGUAGE plpgsql AS $body$",
        "BEGIN",
        `  ${statement}`,
        "END;",
        "$body$;",
      ].join("\n"),
    });

    expectRule(run(root), "PDI008");
  });

  it.each([
    "INSERT INTO public.moods(id,user_id,mood) VALUES ('mood-1','user-1','good');",
    "INSERT INTO ONLY public.moods(id,user_id,mood) VALUES ('mood-1','user-1','good');",
    "COPY public.moods (id,user_id,mood) FROM STDIN;\nmood-1\tuser-1\tgood\n\\.",
    "MERGE INTO public.moods AS target USING (VALUES ('mood-1','user-1','good')) AS source(id,user_id,mood) ON false WHEN NOT MATCHED THEN INSERT(id,user_id,mood) VALUES(source.id,source.user_id,source.mood);",
  ])("blocks additional PostgreSQL user-data write forms", (sql) => {
    const root = fixture({
      "src/main.ts": "export {};",
      "supabase/migrations/20260709000010_user_write.sql": sql,
    });
    expectRule(run(root), "PDI008");
  });

  it("rejects semantic config weakening and broad exclusions", () => {
    const mutations: Array<(config: Record<string, unknown>) => void> = [
      (config) => {
        config.domainFields = ["irrelevant"];
      },
      (config) => {
        config.userDataTables = ["irrelevant"];
      },
      (config) => {
        config.testPathGlobs = ["never/**"];
      },
      (config) => {
        config.scanExcludeGlobs = [
          ...(config.scanExcludeGlobs as string[]),
          "public/**",
          "supabase/**",
          "android/**",
          "ios/**",
          "src-tauri/**",
        ];
      },
      (config) => {
        config.releaseEvidenceExcludeGlobs = [
          ...(config.releaseEvidenceExcludeGlobs as string[]),
          "output/**",
        ];
      },
    ];
    for (const mutate of mutations) {
      const root = fixture({ "src/main.ts": "export {};" }, mutate);
      const result = run(root);
      expect(result.status, JSON.stringify(result.report, null, 2)).toBe(2);
      expect(result.report.status).toBe("ERROR");
    }
  });

  it.each([
    "testPathGlobs",
    "devPathGlobs",
    "generatedPathGlobs",
    "documentationPathGlobs",
    "enforcementPathGlobs",
    "scanExcludeGlobs",
    "sourceExtensions",
    "auditedNonLiteralDynamicImports",
    "domainFields",
    "historySignalFields",
    "timeSignalFields",
    "syntheticMarkers",
    "persistenceSinkNames",
    "externalSinkMarkers",
    "userDataTables",
    "operationalSeedTables",
    "releaseEvidenceRoots",
    "releaseEvidenceGlobs",
    "releaseEvidenceExcludeGlobs",
    "releaseEvidenceStatusFields",
    "bundleSentinels",
  ])("pins code-owned semantic config field %s", (field) => {
    const config = JSON.parse(readFileSync(CONFIG, "utf8")) as Record<string, unknown>;
    (config[field] as unknown[]).push(
      field.includes("Fields") || field.includes("Tables") ? "pdi_mutation" : "pdi-mutation/**"
    );
    expect(() => CORE.validateConfig?.(config)).toThrow(
      new RegExp(`config\\.${field} differs from the code-owned semantic contract`)
    );
  });

  it("pins aliases, limits, and repository contracts while allowing additive production coverage", () => {
    const original = JSON.parse(readFileSync(CONFIG, "utf8")) as Record<string, unknown>;

    const aliases = structuredClone(original);
    aliases.aliases = { "@": "different-root" };
    expect(() => CORE.validateConfig?.(aliases)).toThrow(
      /config\.aliases differs from the code-owned semantic contract/
    );

    const limits = structuredClone(original);
    (limits.limits as Record<string, number>).maxEvidenceAgeHours = 169;
    expect(() => CORE.validateConfig?.(limits)).toThrow(
      /config\.limits differs from the code-owned semantic contract/
    );

    const contracts = structuredClone(original);
    (contracts.repositoryContracts as Array<{ requiredStrings: string[] }>)[0].requiredStrings.push(
      "mutable-no-op-marker"
    );
    expect(() => CORE.validateConfig?.(contracts)).toThrow(
      /config\.repositoryContracts differs from the code-owned semantic contract/
    );

    const additive = structuredClone(original);
    (additive.entrypoints as string[]).push("src/extra-entry.ts");
    (additive.scanRoots as string[]).push("extra-production-root");
    (additive.productionPathGlobs as string[]).push("extra-production-root/**");
    (additive.bundleDirectories as string[]).push("extra-dist");
    expect(() => CORE.validateConfig?.(additive)).not.toThrow();
  });

  it("rejects weakened workflow markers and fake-success package or CLI bootstraps", () => {
    const workflowRoot = fixture(
      {
        "src/main.ts": "export {};",
        ".github/workflows/production-data-integrity.yml": "name: noop\njobs: {}\n",
      },
      (config) => {
        const contract = (
          config.repositoryContracts as Array<{
            path: string;
            requiredStrings: string[];
            forbiddenStrings: string[];
          }>
        ).find((candidate) => candidate.path === ".github/workflows/production-data-integrity.yml");
        if (contract) {
          contract.requiredStrings = ["name:"];
          contract.forbiddenStrings = [];
        }
      }
    );
    expect(run(workflowRoot).status).toBe(2);

    const noOpScripts = {
      "check:production-data-integrity": 'node -e "process.exit(0)"',
      "check:production-data-integrity:diff": 'node -e "process.exit(0)"',
      "check:production-data-integrity:staged": 'node -e "process.exit(0)"',
      "check:production-data-integrity:bundle": 'node -e "process.exit(0)"',
      "test:release-contracts": "scripts/__tests__/production-data-integrity-workflow.test.ts",
    };
    const packageRoot = fixture({
      "src/main.ts": "export {};",
      "package.json": JSON.stringify({ scripts: noOpScripts }),
    });
    expectRule(run(packageRoot), "PDI010");

    const cliRoot = fixture({
      "src/main.ts": "export {};",
      "scripts/check-production-data-integrity.cjs":
        "#!/usr/bin/env node\nprocess.stdout.write('integrity ok\\n');\n",
    });
    expectRule(run(cliRoot), "PDI010");
  });

  it("rejects invalid calendar dates in waivers at a stable reference time", () => {
    const waiver = {
      schemaVersion: "1.0.0",
      waivers: [
        {
          id: "PDI-WAIVER-DATE-1",
          ruleId: "PDI002",
          path: "src/main.ts",
          fingerprint: "a".repeat(64),
          reason: "Temporary exception pending owner remediation",
          risk: "Synthetic history could reach real users",
          owner: "Data Integrity Team",
          approvedBy: "Yehor Petrov",
          createdAt: "2026-02-30",
          expiresAt: "2026-03-30",
          trackingIssue: "PDI-123",
          removalCondition: "Remove after the detector is corrected",
        },
      ],
    };
    expect(() => CORE.validateWaivers?.(waiver, new Date("2026-03-10T12:00:00Z"))).toThrow(
      /dates are invalid/i
    );
  });

  it("rejects control files reached through an ancestor directory symlink", () => {
    const root = fixture({ "src/main.ts": "export {};" });
    const external = mkdtempSync(join(tmpdir(), "zenflow-pdi-config-dir-"));
    for (const name of [
      "production-data-integrity.json",
      "production-data-integrity-baseline.json",
      "production-data-integrity-waivers.json",
    ]) {
      write(external, name, readFileSync(join(root, "config", name), "utf8"));
    }
    rmSync(join(root, "config"), { recursive: true, force: true });
    symlinkSync(external, join(root, "config"), "dir");

    const result = run(root);
    expect(result.status).toBe(2);
    expect(result.report.error).toMatch(/symlink|repository root|realpath/i);
  });
});

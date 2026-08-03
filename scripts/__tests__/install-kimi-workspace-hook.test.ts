import {
  chmod,
  link,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  applyKimiHook,
  inspectKimiHook,
  renderKimiHookBlock,
  restoreKimiBackup,
} from "../install-kimi-workspace-hook.mjs";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Kimi workspace hook installer", () => {
  it("renders one officially shaped, TOML-escaped PreToolUse hook", () => {
    const hookPath = `/tmp/ZenFlow "guard"/agent-workspace-guard.cjs`;
    const block = renderKimiHookBlock(hookPath);

    expect(block).toContain("# zenflow-agent-workspace-guard:v1:start");
    expect(block).toContain('event = "PreToolUse"');
    expect(block).toContain(
      'command = "node \'/tmp/ZenFlow \\"guard\\"/agent-workspace-guard.cjs\' --expected-agent kimi"'
    );
    expect(block).toContain("timeout = 5");
    expect(block.match(/\[\[hooks\]\]/g)).toHaveLength(1);
    expect(block).not.toContain("api_key");
    expect(block).not.toContain("matcher =");
  });

  it("appends idempotently, preserves opaque secrets, backs up privately, and tightens modes", async () => {
    const fixture = await configFixture();
    const original = 'provider = "kimi"\napi_key = "SECRET_SENTINEL"\n';

    const first = await applyKimiHook({
      configPath: fixture.configPath,
      hookPath: fixture.hookPath,
      now: new Date("2026-07-26T18:00:00.000Z"),
    });
    const installed = await readFile(fixture.configPath, "utf8");

    expect(first.changed).toBe(true);
    expect(first.backupPath).toBeTruthy();
    expect(first.receiptPath).toBeTruthy();
    expect(installed).toContain(original);
    expect(installed).toContain("# zenflow-agent-workspace-guard:v1:start");
    expect(await readFile(first.backupPath!, "utf8")).toBe(original);
    const receipt = JSON.parse(await readFile(first.receiptPath!, "utf8"));
    expect(receipt).toMatchObject({
      schema: "zenflow-kimi-hook-install-transaction/v1",
      createdAt: "2026-07-26T18:00:00.000Z",
      configPath: fixture.configPath,
      backup: {
        path: first.backupPath,
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        identity: {
          mode: 0o600,
          regularFile: true,
        },
      },
      target: {
        beforeInstallIdentity: {
          regularFile: true,
        },
        installedIdentity: {
          mode: 0o600,
          regularFile: true,
        },
      },
      retention: {
        automaticRemoval: false,
        ownerRemovalCondition: expect.stringMatching(/owner.*verif/i),
      },
    });
    expect((await stat(fixture.configPath)).mode & 0o777).toBe(0o600);
    expect((await stat(first.backupPath!)).mode & 0o777).toBe(0o600);
    expect((await stat(first.receiptPath!)).mode & 0o777).toBe(0o600);
    expect((await stat(path.dirname(fixture.configPath))).mode & 0o777).toBe(0o700);

    const second = await applyKimiHook({
      configPath: fixture.configPath,
      hookPath: fixture.hookPath,
      now: new Date("2026-07-26T18:01:00.000Z"),
    });
    expect(second).toMatchObject({ changed: false, backupPath: null, receiptPath: null });
    expect((await readFile(fixture.configPath, "utf8")).match(/\[\[hooks\]\]/g)).toHaveLength(1);
  });

  it("rejects an idempotent success when the config ancestor is replaced after read", async () => {
    const fixture = await configFixture();
    await applyKimiHook({
      configPath: fixture.configPath,
      hookPath: fixture.hookPath,
      now: new Date("2026-07-26T18:00:00.000Z"),
    });
    const installed = await readFile(fixture.configPath, "utf8");
    const displacedKimiDir = `${fixture.kimiDir}.owner-original`;

    await expect(
      applyKimiHook({
        configPath: fixture.configPath,
        hookPath: fixture.hookPath,
        beforeCommit: async () => {
          await rename(fixture.kimiDir, displacedKimiDir);
          await mkdir(fixture.kimiDir, { mode: 0o755 });
          await writeFile(fixture.configPath, installed, {
            flag: "wx",
            mode: 0o640,
          });
        },
      })
    ).rejects.toThrow(/changed during installation|ancestor/i);

    expect(await readFile(fixture.configPath, "utf8")).toBe(installed);
    expect((await stat(fixture.configPath)).mode & 0o777).toBe(0o640);
    expect(await readFile(path.join(displacedKimiDir, "config.toml"), "utf8")).toBe(installed);
  });

  it("rejects an idempotent success when the final config component is replaced after read", async () => {
    const fixture = await configFixture();
    await applyKimiHook({
      configPath: fixture.configPath,
      hookPath: fixture.hookPath,
      now: new Date("2026-07-26T18:00:00.000Z"),
    });
    const installed = await readFile(fixture.configPath, "utf8");
    const displacedConfig = `${fixture.configPath}.owner-original`;

    await expect(
      applyKimiHook({
        configPath: fixture.configPath,
        hookPath: fixture.hookPath,
        beforeCommit: async () => {
          await rename(fixture.configPath, displacedConfig);
          await writeFile(fixture.configPath, installed, {
            flag: "wx",
            mode: 0o640,
          });
        },
      })
    ).rejects.toThrow(/changed during installation/i);

    expect(await readFile(fixture.configPath, "utf8")).toBe(installed);
    expect((await stat(fixture.configPath)).mode & 0o777).toBe(0o640);
    expect(await readFile(displacedConfig, "utf8")).toBe(installed);
  });

  it("rejects an ancestor replacement before creating the private backup", async () => {
    const fixture = await configFixture();
    const original = await readFile(fixture.configPath, "utf8");
    const displacedKimiDir = `${fixture.kimiDir}.owner-original`;
    const backupPath = `${fixture.configPath}.zenflow-backup-20260726T180000000Z`;

    await expect(
      applyKimiHook({
        configPath: fixture.configPath,
        hookPath: fixture.hookPath,
        now: new Date("2026-07-26T18:00:00.000Z"),
        beforeBackup: async () => {
          await rename(fixture.kimiDir, displacedKimiDir);
          await mkdir(fixture.kimiDir, { mode: 0o755 });
          await writeFile(fixture.configPath, original, {
            flag: "wx",
            mode: 0o640,
          });
        },
      })
    ).rejects.toThrow(/changed during installation|ancestor/i);

    await expect(stat(backupPath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(fixture.configPath, "utf8")).toBe(original);
    expect((await stat(fixture.configPath)).mode & 0o777).toBe(0o640);
    expect(await readFile(path.join(displacedKimiDir, "config.toml"), "utf8")).toBe(original);
  });

  it("never overwrites a final-component backup created at the commit boundary", async () => {
    const fixture = await configFixture();
    const backupPath = `${fixture.configPath}.zenflow-backup-20260726T180000000Z`;
    const ownerBackup = "OWNER_BACKUP_DO_NOT_OVERWRITE\n";

    await expect(
      applyKimiHook({
        configPath: fixture.configPath,
        hookPath: fixture.hookPath,
        now: new Date("2026-07-26T18:00:00.000Z"),
        beforeBackup: async () => {
          await writeFile(backupPath, ownerBackup, {
            flag: "wx",
            mode: 0o600,
          });
        },
      })
    ).rejects.toThrow(/backup already exists|overwrite/i);

    expect(await readFile(backupPath, "utf8")).toBe(ownerBackup);
  });

  it("check mode reports stale paths and secure installation without printing config content", async () => {
    const fixture = await configFixture();
    await applyKimiHook({
      configPath: fixture.configPath,
      hookPath: fixture.hookPath,
      now: new Date("2026-07-26T18:00:00.000Z"),
    });

    expect(
      await inspectKimiHook({
        configPath: fixture.configPath,
        hookPath: fixture.hookPath,
      })
    ).toMatchObject({
      installed: true,
      secureMode: true,
      stale: false,
    });
    expect(
      await inspectKimiHook({
        configPath: fixture.configPath,
        hookPath: `${fixture.hookPath}.moved`,
      })
    ).toMatchObject({
      installed: true,
      stale: true,
    });
  });

  it.each([
    ["basic", '"""'],
    ["literal", "'''"],
  ])(
    "rejects an exact managed block hidden inside a TOML multiline %s string",
    async (_kind, delimiter) => {
      const fixture = await configFixture();
      const block = renderKimiHookBlock(fixture.hookPath);
      await writeFile(
        fixture.configPath,
        `provider = "kimi"\npayload = ${delimiter}\n${block}\n${delimiter}\n`,
        "utf8"
      );
      await chmod(fixture.configPath, 0o600);

      expect(
        await inspectKimiHook({
          configPath: fixture.configPath,
          hookPath: fixture.hookPath,
        })
      ).toMatchObject({
        installed: false,
        stale: true,
      });

      const check = runKimiCheck(fixture);
      expect(check.status).toBe(2);
      expect(check.stdout).toBe("Kimi workspace hook: UNVERIFIED\n");
      expect(check.stderr).not.toContain("SECRET_SENTINEL");
    }
  );

  it.each([
    ["duplicate start", (block: string) => `${block}\n# zenflow-agent-workspace-guard:v1:start\n`],
    ["duplicate end", (block: string) => `${block}\n# zenflow-agent-workspace-guard:v1:end\n`],
    [
      "missing end",
      (block: string) => block.replace("\n# zenflow-agent-workspace-guard:v1:end", ""),
    ],
    [
      "reversed markers",
      (block: string) =>
        block
          .replace(
            "# zenflow-agent-workspace-guard:v1:start",
            "# zenflow-agent-workspace-guard:v1:temporary"
          )
          .replace(
            "# zenflow-agent-workspace-guard:v1:end",
            "# zenflow-agent-workspace-guard:v1:start"
          )
          .replace(
            "# zenflow-agent-workspace-guard:v1:temporary",
            "# zenflow-agent-workspace-guard:v1:end"
          ),
    ],
  ])("fails closed for %s markers", async (_caseName, mutate) => {
    const fixture = await configFixture();
    const malformed = mutate(renderKimiHookBlock(fixture.hookPath));
    await writeFile(fixture.configPath, `${malformed}\n`, "utf8");
    await chmod(fixture.configPath, 0o600);

    const proof = await inspectKimiHook({
      configPath: fixture.configPath,
      hookPath: fixture.hookPath,
    });
    expect(proof.installed).toBe(false);
    expect(proof.stale).toBe(true);

    const check = runKimiCheck(fixture);
    expect(check.status).toBe(2);
    expect(check.stdout).toBe("Kimi workspace hook: UNVERIFIED\n");
  });

  it("refuses to rewrite malformed managed markers during apply", async () => {
    const fixture = await configFixture();
    const malformed = `${renderKimiHookBlock(fixture.hookPath)}\n# zenflow-agent-workspace-guard:v1:end\n`;
    await writeFile(fixture.configPath, malformed, "utf8");

    await expect(
      applyKimiHook({
        configPath: fixture.configPath,
        hookPath: fixture.hookPath,
      })
    ).rejects.toThrow(/malformed|duplicate|marker/i);
    expect(await readFile(fixture.configPath, "utf8")).toBe(malformed);
  });

  it("refuses installation when the selected workspace guard hook is missing", async () => {
    const fixture = await configFixture();
    await rm(fixture.hookPath);

    await expect(
      applyKimiHook({
        configPath: fixture.configPath,
        hookPath: fixture.hookPath,
      })
    ).rejects.toThrow(/workspace guard hook/);
  });

  it("refuses to read or replace a hard-linked Kimi config", async () => {
    const fixture = await configFixture();
    const ownerAlias = `${fixture.configPath}.owner-alias`;
    const original = await readFile(fixture.configPath, "utf8");
    await link(fixture.configPath, ownerAlias);

    await expect(
      applyKimiHook({
        configPath: fixture.configPath,
        hookPath: fixture.hookPath,
      })
    ).rejects.toThrow(/single-link|hard link/i);

    expect(await readFile(fixture.configPath, "utf8")).toBe(original);
    expect(await readFile(ownerAlias, "utf8")).toBe(original);
  });

  it("never overwrites an existing timestamped backup", async () => {
    const fixture = await configFixture();
    const backupPath = `${fixture.configPath}.zenflow-backup-20260726T180000000Z`;
    await writeFile(backupPath, "DO NOT OVERWRITE\n", { mode: 0o600 });

    await expect(
      applyKimiHook({
        configPath: fixture.configPath,
        hookPath: fixture.hookPath,
        now: new Date("2026-07-26T18:00:00.000Z"),
      })
    ).rejects.toThrow();
    expect(await readFile(backupPath, "utf8")).toBe("DO NOT OVERWRITE\n");
    expect(await readFile(fixture.configPath, "utf8")).toBe(
      'provider = "kimi"\napi_key = "SECRET_SENTINEL"\n'
    );
  });

  it("refuses to replace config changed concurrently after the private backup", async () => {
    const fixture = await configFixture();
    const concurrent = 'provider = "kimi"\napi_key = "CONCURRENT_OWNER_CHANGE"\n';

    await expect(
      applyKimiHook({
        configPath: fixture.configPath,
        hookPath: fixture.hookPath,
        now: new Date("2026-07-26T18:00:00.000Z"),
        beforeReplace: async () => {
          await writeFile(fixture.configPath, concurrent, { mode: 0o600 });
        },
      })
    ).rejects.toThrow(/changed during installation/i);
    expect(await readFile(fixture.configPath, "utf8")).toBe(concurrent);
  });

  it("does not overwrite a concurrent config created at the final commit boundary", async () => {
    const fixture = await configFixture();
    const concurrent = 'provider = "kimi"\napi_key = "FINAL_BOUNDARY_OWNER_CHANGE"\n';

    await expect(
      applyKimiHook({
        configPath: fixture.configPath,
        hookPath: fixture.hookPath,
        now: new Date("2026-07-26T18:00:00.000Z"),
        beforeCommit: async () => {
          await writeFile(fixture.configPath, concurrent, {
            flag: "wx",
            mode: 0o600,
          });
        },
      })
    ).rejects.toThrow(/changed during installation/i);
    expect(await readFile(fixture.configPath, "utf8")).toBe(concurrent);
  });

  it("restores only a private sibling backup and leaves the backup recoverable", async () => {
    const fixture = await configFixture();
    const applied = await applyKimiHook({
      configPath: fixture.configPath,
      hookPath: fixture.hookPath,
      now: new Date("2026-07-26T18:00:00.000Z"),
    });

    await restoreKimiBackup({
      backupPath: applied.backupPath!,
      configPath: fixture.configPath,
      receiptPath: applied.receiptPath!,
    });

    expect(await readFile(fixture.configPath, "utf8")).toBe(
      'provider = "kimi"\napi_key = "SECRET_SENTINEL"\n'
    );
    expect((await stat(fixture.configPath)).mode & 0o777).toBe(0o600);
    expect((await stat(applied.backupPath!)).isFile()).toBe(true);
    expect((await stat(applied.receiptPath!)).isFile()).toBe(true);
  });

  it("refuses restoration from a backup that is not mode 0600", async () => {
    const fixture = await configFixture();
    const applied = await applyKimiHook({
      configPath: fixture.configPath,
      hookPath: fixture.hookPath,
      now: new Date("2026-07-26T18:00:00.000Z"),
    });
    await chmod(applied.backupPath!, 0o644);
    const installed = await readFile(fixture.configPath, "utf8");

    await expect(
      restoreKimiBackup({
        backupPath: applied.backupPath!,
        configPath: fixture.configPath,
        receiptPath: applied.receiptPath!,
      })
    ).rejects.toThrow(/0600|private/i);
    expect(await readFile(fixture.configPath, "utf8")).toBe(installed);
  });

  it("refuses restoration from a hard-linked private backup", async () => {
    const fixture = await configFixture();
    const applied = await applyKimiHook({
      configPath: fixture.configPath,
      hookPath: fixture.hookPath,
      now: new Date("2026-07-26T18:00:00.000Z"),
    });
    const ownerAlias = `${applied.backupPath}.owner-alias`;
    await link(applied.backupPath!, ownerAlias);
    const installed = await readFile(fixture.configPath, "utf8");

    await expect(
      restoreKimiBackup({
        backupPath: applied.backupPath!,
        configPath: fixture.configPath,
        receiptPath: applied.receiptPath!,
      })
    ).rejects.toThrow(/single-link|hard link/i);

    expect(await readFile(fixture.configPath, "utf8")).toBe(installed);
    expect(await readFile(ownerAlias, "utf8")).toBe(
      'provider = "kimi"\napi_key = "SECRET_SENTINEL"\n'
    );
  });

  it("rejects restoration when the receipt belongs to a different backup", async () => {
    const fixture = await configFixture();
    const applied = await applyKimiHook({
      configPath: fixture.configPath,
      hookPath: fixture.hookPath,
      now: new Date("2026-07-26T18:00:00.000Z"),
    });
    const installed = await readFile(fixture.configPath, "utf8");
    const wrongBackup = `${fixture.configPath}.zenflow-backup-20260726T180500000Z`;
    await writeFile(wrongBackup, 'provider = "wrong-fixture"\n', {
      flag: "wx",
      mode: 0o600,
    });

    await expect(
      restoreKimiBackup({
        backupPath: wrongBackup,
        configPath: fixture.configPath,
        receiptPath: applied.receiptPath!,
      })
    ).rejects.toThrow(/receipt.*backup|transaction.*backup/i);

    expect(await readFile(fixture.configPath, "utf8")).toBe(installed);
    expect(await readFile(wrongBackup, "utf8")).toBe('provider = "wrong-fixture"\n');
  });

  it("rejects restoration after the installed target identity changes", async () => {
    const fixture = await configFixture();
    const applied = await applyKimiHook({
      configPath: fixture.configPath,
      hookPath: fixture.hookPath,
      now: new Date("2026-07-26T18:00:00.000Z"),
    });
    const ownerEdit = `${await readFile(fixture.configPath, "utf8")}# owner fixture edit\n`;
    await writeFile(fixture.configPath, ownerEdit, { mode: 0o600 });

    await expect(
      restoreKimiBackup({
        backupPath: applied.backupPath!,
        configPath: fixture.configPath,
        receiptPath: applied.receiptPath!,
      })
    ).rejects.toThrow(/target identity/i);

    expect(await readFile(fixture.configPath, "utf8")).toBe(ownerEdit);
    expect((await stat(applied.backupPath!)).isFile()).toBe(true);
    expect((await stat(applied.receiptPath!)).isFile()).toBe(true);
  });

  it("rejects restoration when the config ancestor is replaced before commit", async () => {
    const fixture = await configFixture();
    const applied = await applyKimiHook({
      configPath: fixture.configPath,
      hookPath: fixture.hookPath,
      now: new Date("2026-07-26T18:00:00.000Z"),
    });
    const installed = await readFile(fixture.configPath, "utf8");
    const displacedKimiDir = `${fixture.kimiDir}.owner-original`;

    await expect(
      restoreKimiBackup({
        backupPath: applied.backupPath!,
        configPath: fixture.configPath,
        receiptPath: applied.receiptPath!,
        beforeCommit: async () => {
          await rename(fixture.kimiDir, displacedKimiDir);
          await mkdir(fixture.kimiDir, { mode: 0o755 });
          await writeFile(fixture.configPath, installed, {
            flag: "wx",
            mode: 0o640,
          });
        },
      })
    ).rejects.toThrow(/changed during restoration|ancestor/i);

    expect(await readFile(fixture.configPath, "utf8")).toBe(installed);
    expect((await stat(fixture.configPath)).mode & 0o777).toBe(0o640);
    expect(
      (await stat(path.join(displacedKimiDir, path.basename(applied.backupPath!)))).isFile()
    ).toBe(true);
    expect(
      (await stat(path.join(displacedKimiDir, path.basename(applied.receiptPath!)))).isFile()
    ).toBe(true);
  });

  it("does not overwrite a final config component created at the restore commit boundary", async () => {
    const fixture = await configFixture();
    const applied = await applyKimiHook({
      configPath: fixture.configPath,
      hookPath: fixture.hookPath,
      now: new Date("2026-07-26T18:00:00.000Z"),
    });
    const concurrent = 'provider = "kimi"\napi_key = "RESTORE_OWNER_CHANGE"\n';

    await expect(
      restoreKimiBackup({
        backupPath: applied.backupPath!,
        configPath: fixture.configPath,
        receiptPath: applied.receiptPath!,
        beforeCommit: async () => {
          await writeFile(fixture.configPath, concurrent, {
            flag: "wx",
            mode: 0o600,
          });
        },
      })
    ).rejects.toThrow(/changed during restoration/i);

    expect(await readFile(fixture.configPath, "utf8")).toBe(concurrent);
    expect((await stat(applied.backupPath!)).isFile()).toBe(true);
    expect((await stat(applied.receiptPath!)).isFile()).toBe(true);
  });
});

async function configFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "zenflow-kimi-config-"));
  roots.push(root);
  const kimiDir = path.join(root, ".kimi-code");
  const configPath = path.join(kimiDir, "config.toml");
  const hookPath = path.join(root, "repo", ".codex", "hooks", "agent-workspace-guard.cjs");
  await mkdir(kimiDir, { mode: 0o755 });
  await mkdir(path.dirname(hookPath), { recursive: true, mode: 0o700 });
  await chmod(kimiDir, 0o755);
  await writeFile(configPath, 'provider = "kimi"\napi_key = "SECRET_SENTINEL"\n', {
    encoding: "utf8",
    mode: 0o644,
  });
  await writeFile(hookPath, "#!/usr/bin/env node\n", {
    encoding: "utf8",
    mode: 0o700,
  });
  return { configPath, hookPath, kimiDir };
}

function runKimiCheck(fixture: Awaited<ReturnType<typeof configFixture>>) {
  return spawnSync(
    process.execPath,
    [
      path.resolve("scripts/install-kimi-workspace-hook.mjs"),
      "--check",
      "--config",
      fixture.configPath,
      "--hook",
      fixture.hookPath,
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    }
  );
}

import { spawnSync } from "node:child_process";
import { lstat, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  exportPrivateReceipt,
  TRUST_ANCHOR_REQUIRED_CODE,
} from "../codex-governance/export-private-receipt.cjs";

const EXPORTER = path.resolve("scripts/codex-governance/export-private-receipt.cjs");
const roots = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("private receipt export boundary", () => {
  it("fails closed even when a local token and approval ledger claim an export is approved", async () => {
    const rootDir = await workspace();
    const source = path.join(rootDir, ".superpowers", "receipt-20260723");
    const destination = path.join(rootDir, "external", "people-first-app-20260723-local-approval");
    await mkdir(source, { recursive: true });
    await writeFile(
      path.join(rootDir, ".preflight-token"),
      JSON.stringify({ verdict: "GO", receipt_export: "locally-forged" }),
      "utf8",
    );
    await writeFile(path.join(source, "approval.tsv"), "locally-forged\n", "utf8");

    let error;
    try {
      exportPrivateReceipt({ rootDir, source, destination, authorizationPath: ".preflight-token" });
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({ code: TRUST_ANCHOR_REQUIRED_CODE });
    await expect(lstat(destination)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not reflect caller paths or create a destination when invoked through the CLI", async () => {
    const rootDir = await workspace();
    const privateCanary = "private-journal-canary-should-not-appear";
    const destination = path.join(rootDir, "external", "people-first-app-20260723-cli-denial");

    const result = spawnSync(process.execPath, [
      EXPORTER,
      "--source",
      privateCanary,
      "--destination",
      destination,
      "--authorization",
      ".preflight-token",
    ], {
      cwd: rootDir,
      encoding: "utf8",
    });

    expect(result.status, result.stderr).toBe(1);
    expect(result.stderr).toContain("trusted owner authorization provider");
    expect(`${result.stdout}${result.stderr}`).not.toContain(privateCanary);
    await expect(lstat(destination)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "zenflow-private-receipt-"));
  roots.push(root);
  return root;
}

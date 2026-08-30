#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { validateEvidenceLedger } from "./evidence-lib.mjs";

const [command, ledgerPath, runPath] = process.argv.slice(2);
if (!new Set(["validate", "append-run"]).has(command) || !ledgerPath || (command === "append-run" && !runPath)) {
  throw new Error("Usage: ledger.mjs validate <ledger.json> | append-run <ledger.json> <run.json>");
}
const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
if (command === "append-run") {
  const run = JSON.parse(await readFile(runPath, "utf8"));
  ledger.runs.push(run);
  validateEvidenceLedger(ledger);
  await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
} else {
  validateEvidenceLedger(ledger);
}
console.log(JSON.stringify({ command, ledger: ledgerPath, runs: ledger.runs.length }));

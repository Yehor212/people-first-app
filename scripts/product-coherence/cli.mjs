#!/usr/bin/env node
import {
  loadAuditBundle,
  renderAuditMarkdown,
  validateAuditBundleWithLocalArtifacts,
} from "./core.mjs";
import { enumerateRepositoryCandidates } from "./inventory.mjs";

const [command, ...args] = process.argv.slice(2);

try {
  if (command === "inventory") {
    const root = exactOption(args, "--root");
    const subjectId = exactOption(args, "--subject");
    if (args.length !== 4) throw new Error("inventory requires --root <repository> --subject <subject-id>");
    const inventory = await enumerateRepositoryCandidates(root, subjectId);
    process.stdout.write(`${JSON.stringify(inventory)}\n`);
  } else if (command === "validate" || command === "report") {
    const inputDirectory = exactOption(args, "--input");
    if (args.length !== 2) throw new Error(`${command} requires --input <ledger-directory>`);
    const bundle = await loadAuditBundle(inputDirectory);
    const result = await validateAuditBundleWithLocalArtifacts(bundle, inputDirectory);
    if (command === "validate") {
      process.stdout.write(`${JSON.stringify(result)}\n`);
    } else if (result.ok) {
      process.stdout.write(renderAuditMarkdown(bundle));
    } else {
      process.stderr.write(`${result.errors.join("\n")}\n`);
    }
    process.exitCode = result.ok ? 0 : 1;
  } else {
    throw new Error("usage: cli.mjs inventory --root <repo> --subject <id> | <validate|report> --input <ledger-directory>");
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
}

function exactOption(args, name) {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

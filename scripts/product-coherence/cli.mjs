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
    const { inputDirectory, subjectRoots } = parseLedgerArguments(args, command);
    const bundle = await loadAuditBundle(inputDirectory);
    const result = await validateAuditBundleWithLocalArtifacts(bundle, inputDirectory, subjectRoots);
    if (command === "validate") {
      process.stdout.write(`${JSON.stringify(result)}\n`);
    } else if (result.ok) {
      process.stdout.write(renderAuditMarkdown(bundle));
    } else {
      process.stderr.write(`${result.errors.join("\n")}\n`);
    }
    process.exitCode = result.ok ? 0 : 1;
  } else {
    throw new Error(
      "usage: cli.mjs inventory --root <repo> --subject <id> | <validate|report> --input <ledger-directory> [--subject-root <subject-id>=<git-root>]",
    );
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

function parseLedgerArguments(args, command) {
  let inputDirectory;
  const subjectRoots = {};
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${name ?? command} requires a value`);
    if (name === "--input") {
      if (inputDirectory) throw new Error("--input may only be provided once");
      inputDirectory = value;
      continue;
    }
    if (name === "--subject-root") {
      const separator = value.indexOf("=");
      if (separator <= 0 || separator === value.length - 1) {
        throw new Error("--subject-root requires <subject-id>=<git-root>");
      }
      const subjectId = value.slice(0, separator);
      if (subjectRoots[subjectId]) throw new Error(`duplicate --subject-root for ${subjectId}`);
      subjectRoots[subjectId] = value.slice(separator + 1);
      continue;
    }
    throw new Error(`unexpected option ${name}`);
  }
  if (!inputDirectory) throw new Error(`${command} requires --input <ledger-directory>`);
  return { inputDirectory, subjectRoots };
}

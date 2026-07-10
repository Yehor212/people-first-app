#!/usr/bin/env node
"use strict";

const { runIntegrityCheck, SCHEMA_VERSION } = require("./production-data-integrity/core.cjs");

function parseArguments(argv) {
  const options = {
    mode: null,
    json: false,
    base: null,
    configPath: "config/production-data-integrity.json",
    bundleDirectories: [],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--all" || argument === "--diff" || argument === "--staged") {
      const mode = argument.slice(2);
      if (options.mode && options.mode !== mode) throw new Error("choose exactly one of --all, --diff, or --staged");
      options.mode = mode;
    } else if (argument === "--json") {
      options.json = true;
    } else if (argument === "--base" || argument === "--config" || argument === "--bundle") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`);
      index += 1;
      if (argument === "--base") options.base = value;
      else if (argument === "--config") options.configPath = value;
      else options.bundleDirectories.push(value);
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  options.mode ||= "all";
  return options;
}

function errorReport(mode, error) {
  return {
    schemaVersion: SCHEMA_VERSION,
    status: "ERROR",
    mode: mode || "all",
    head: null,
    base: null,
    findings: [],
    summary: { errors: 0, warnings: 0, baselined: 0, waived: 0, scannedFiles: 0, reachableFiles: 0 },
    error: error && error.message ? error.message : String(error),
  };
}

function printHuman(report) {
  for (const finding of report.findings) {
    const state = finding.baselined ? "BASELINED" : finding.waived ? "WAIVED" : finding.severity.toUpperCase();
    process.stdout.write(`[production-data-integrity] ${state} ${finding.ruleId} ${finding.path}:${finding.line}:${finding.column} ${finding.message}\n`);
  }
  process.stdout.write(
    `[production-data-integrity] ${report.status} mode=${report.mode} errors=${report.summary.errors} warnings=${report.summary.warnings} baselined=${report.summary.baselined} waived=${report.summary.waived} scanned=${report.summary.scannedFiles} reachable=${report.summary.reachableFiles}\n`,
  );
}

function main(argv = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseArguments(argv);
    const report = runIntegrityCheck({
      root: process.cwd(),
      mode: parsed.mode,
      base: parsed.base,
      configPath: parsed.configPath,
      bundleDirectories: parsed.bundleDirectories,
    });
    if (parsed.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else printHuman(report);
    return report.status === "FAIL" ? 1 : 0;
  } catch (error) {
    const report = errorReport(parsed && parsed.mode, error);
    const jsonRequested = parsed ? parsed.json : argv.includes("--json");
    if (jsonRequested) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stderr.write(`[production-data-integrity] ERROR ${report.error}\n`);
    return 2;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = { errorReport, main, parseArguments, printHuman };

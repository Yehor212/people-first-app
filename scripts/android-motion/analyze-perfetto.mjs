#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildTraceSummaryQueries, hashPath, parseTraceProcessorCsv } from "./evidence-lib.mjs";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    if (!argv[index]?.startsWith("--") || argv[index + 1] === undefined) throw new Error("Usage: analyze-perfetto.mjs --trace <trace> --trace-processor <binary> --output <json> [--package com.zenflow.app]");
    args[argv[index].slice(2)] = argv[index + 1];
  }
  for (const required of ["trace", "trace-processor", "output"]) if (!args[required]) throw new Error(`Missing --${required}`);
  return args;
}

function query(binary, trace, sql) {
  const stdout = execFileSync(binary, ["query", trace, sql], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  return parseTraceProcessorCsv(stdout);
}

function convertRow(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (value === "[NULL]" || value === "") return [key, null];
    const number = Number(value);
    return [key, Number.isFinite(number) ? number : value];
  }));
}

const args = parseArgs(process.argv.slice(2));
const packageName = args.package || "com.zenflow.app";
const queries = buildTraceSummaryQueries(packageName);
const frameTimeline = convertRow(query(args["trace-processor"], args.trace, queries.frameTimeline)[0] || {});
const webViewDraw = convertRow(query(args["trace-processor"], args.trace, queries.webViewDraw)[0] || {});
const threadCpu = query(args["trace-processor"], args.trace, queries.threadCpu).map(convertRow);
const traceHash = await hashPath(args.trace);
const report = {
  schemaVersion: 1,
  analyzedAt: new Date().toISOString(),
  packageName,
  trace: { sha256: traceHash.sha256, bytes: traceHash.bytes },
  frameTimeline,
  webViewDraw,
  threadCpu,
};
const output = path.resolve(args.output);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
console.log(JSON.stringify({ output: args.output, traceSha256: traceHash.sha256, frameTimeline, webViewDraw }));

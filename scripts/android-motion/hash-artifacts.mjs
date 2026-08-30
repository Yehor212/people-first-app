#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { hashPath } from "./evidence-lib.mjs";

const argv = process.argv.slice(2);
const outputIndex = argv.indexOf("--output");
if (outputIndex < 0 || !argv[outputIndex + 1]) throw new Error("Usage: hash-artifacts.mjs --output <manifest.json> <artifact> [...]");
const output = argv[outputIndex + 1];
const inputs = argv.filter((_, index) => index !== outputIndex && index !== outputIndex + 1);
if (inputs.length === 0) throw new Error("At least one artifact path is required");

const artifacts = [];
for (const input of inputs) artifacts.push({ label: path.basename(path.resolve(input)), ...(await hashPath(input)) });
const resolvedOutput = path.resolve(output);
await mkdir(path.dirname(resolvedOutput), { recursive: true });
await writeFile(resolvedOutput, `${JSON.stringify({ schemaVersion: 1, createdAt: new Date().toISOString(), artifacts }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
console.log(JSON.stringify({ output, artifacts: artifacts.map(({ label, sha256, fileCount }) => ({ label, sha256, fileCount })) }));

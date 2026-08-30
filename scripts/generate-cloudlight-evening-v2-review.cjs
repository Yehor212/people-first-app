#!/usr/bin/env node
"use strict";

const path = require("node:path");
const { writeCloudlightV2ReviewPack } = require("./cloudlight-evening-v2-synthesis.cjs");

const rootDir = process.cwd();
const outputDir = path.join(rootDir, "output", "private", "cloudlight-evening-v2-review");
const result = writeCloudlightV2ReviewPack({ rootDir, outputDir });

for (const candidate of result.manifest.candidates) {
  console.log(
    "[cloudlight-v2] wrote " +
      candidate.fileName +
      " " +
      candidate.bytes +
      " bytes sha256=" +
      candidate.sha256
  );
}
console.log("[cloudlight-v2] private review pack: " + result.outputDir);
console.log("[cloudlight-v2] artistic status: " + result.manifest.artisticStatus);

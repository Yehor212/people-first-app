"use strict";

const path = require("node:path");
const { writeCloudlightR3SourcePack } = require("./cloudlight-evening-r3-source.cjs");

if (process.argv.length !== 2) {
  throw new Error("Cloudlight R3 source generation does not accept caller-supplied arguments");
}

const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "output", "private", "cloudlight-evening-r3", "source");
const receipt = writeCloudlightR3SourcePack({ rootDir, outputDir });

console.log(JSON.stringify({ status: "SOURCE_READY", ...receipt.summary }));

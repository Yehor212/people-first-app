#!/usr/bin/env node
const path = require("path");
const { execFileSync } = require("child_process");

const generator = path.join(__dirname, "generate-icons.cjs");

execFileSync(process.execPath, [generator], {
  cwd: path.resolve(__dirname, ".."),
  stdio: "inherit",
});

#!/usr/bin/env node
"use strict";

/**
 * Capacitor can generate Swift Package local paths with Windows separators when
 * `cap sync ios` runs on Windows. Swift Package Manager expects POSIX-style
 * paths on macOS CI/Xcode, so keep the checked-in package manifest portable.
 */

const fs = require("node:fs");
const path = require("node:path");

const manifestPath = path.join(__dirname, "..", "ios", "App", "CapApp-SPM", "Package.swift");

if (!fs.existsSync(manifestPath)) {
  console.log("[ios-spm] SKIP - ios/App/CapApp-SPM/Package.swift not found");
  process.exit(0);
}

const before = fs.readFileSync(manifestPath, "utf8");
const after = before.replace(/\\/g, "/");

if (after !== before) {
  fs.writeFileSync(manifestPath, after);
  console.log("[ios-spm] PASS - normalized Swift Package paths");
} else {
  console.log("[ios-spm] PASS - Swift Package paths already portable");
}

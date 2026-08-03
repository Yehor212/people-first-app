#!/usr/bin/env node
"use strict";

const TRUST_ANCHOR_REQUIRED_CODE = "RECEIPT_EXPORT_TRUST_ANCHOR_REQUIRED";
const TRUST_ANCHOR_REQUIRED_MESSAGE =
  "external receipt export is disabled until a trusted owner authorization provider is provisioned";

function exportPrivateReceipt() {
  const error = new Error(TRUST_ANCHOR_REQUIRED_MESSAGE);
  error.code = TRUST_ANCHOR_REQUIRED_CODE;
  throw error;
}

function main() {
  try {
    exportPrivateReceipt();
  } catch (error) {
    process.stderr.write(`private receipt export failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  exportPrivateReceipt,
  TRUST_ANCHOR_REQUIRED_CODE,
};

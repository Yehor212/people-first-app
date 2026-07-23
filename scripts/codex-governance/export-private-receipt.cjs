#!/usr/bin/env node
"use strict";

// A local receipt ledger and a local preflight token are not an owner-authenticated
// authorization channel. Keep the external-copy path closed until the repository
// has an owner-controlled trust anchor that the exporter can verify independently.
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
    // Do not reflect paths, arguments, or ledger contents to the terminal.
    process.stderr.write(`private receipt export failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  exportPrivateReceipt,
  TRUST_ANCHOR_REQUIRED_CODE,
};

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const METRICS = ["lines", "functions", "statements", "branches"];

function readCount(metric, field, label) {
  const value = metric?.[field];
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new Error(`Coverage ${label}.${field} must be a non-negative integer`);
  }
  return value;
}

export function validateCoverageSummary(summary) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    throw new Error("Coverage summary must be a JSON object");
  }
  if (!summary.total || typeof summary.total !== "object") {
    throw new Error("Coverage summary is missing aggregate totals");
  }

  const fileEntries = Object.entries(summary).filter(([file]) => file !== "total");
  const sourceEntries = fileEntries.filter(([file]) => {
    const normalized = file.replaceAll("\\", "/");
    return /(?:^|\/)src\/.+\.(?:ts|tsx)$/i.test(normalized) && !/\.d\.ts$/i.test(normalized);
  });

  const totals = {};
  for (const metricName of METRICS) {
    const aggregateTotal = readCount(summary.total[metricName], "total", `total.${metricName}`);
    const aggregateCovered = readCount(
      summary.total[metricName],
      "covered",
      `total.${metricName}`,
    );
    if (aggregateTotal === 0) {
      throw new Error("Coverage report has zero executable totals and cannot prove coverage");
    }
    if (aggregateCovered > aggregateTotal) {
      throw new Error(`Coverage total.${metricName}.covered exceeds its total`);
    }

    let fileTotal = 0;
    let fileCovered = 0;
    for (const [file, metrics] of fileEntries) {
      const metric = metrics?.[metricName];
      fileTotal += readCount(metric, "total", `${file}.${metricName}`);
      fileCovered += readCount(metric, "covered", `${file}.${metricName}`);
    }
    if (fileTotal !== aggregateTotal || fileCovered !== aggregateCovered) {
      throw new Error(`Coverage total.${metricName} does not match file totals`);
    }
    totals[metricName] = aggregateTotal;
  }

  if (sourceEntries.length === 0) {
    throw new Error("Coverage report contains no TypeScript application source under src/");
  }

  return { sourceFileCount: sourceEntries.length, totals };
}

export function checkCoverageEvidence(summaryPath = resolve("coverage/coverage-summary.json")) {
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  return validateCoverageSummary(summary);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 2) {
    throw new Error("check-coverage-evidence does not accept custom paths or options");
  }
  const result = checkCoverageEvidence();
  console.log(
    `[coverage-evidence] PASS: ${result.sourceFileCount} TypeScript source files; ` +
      METRICS.map((metric) => `${metric}=${result.totals[metric]}`).join(", "),
  );
}

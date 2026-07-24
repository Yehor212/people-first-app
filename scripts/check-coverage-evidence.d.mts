export interface CoverageEvidenceResult {
  sourceFileCount: number;
  totals: Record<string, number>;
}

export function validateCoverageSummary(summary: unknown): CoverageEvidenceResult;

export function checkCoverageEvidence(summaryPath?: string): CoverageEvidenceResult;

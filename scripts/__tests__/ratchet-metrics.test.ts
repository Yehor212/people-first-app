import { describe, expect, it } from "vitest";
import { isDebtMarkerComment } from "../ratchet-metrics";

describe("ratchet debt marker detection", () => {
  it.each([
    "const sample = 'ZEN-XXXXXX';",
    'placeholder="ZF-XXXXXXXX"',
    'invalidChallengeCode: "Format: ZEN-XXXXXX"',
  ])("does not count product copy as a debt comment: %s", (line) => {
    expect(isDebtMarkerComment(line)).toBe(false);
  });

  it.each([
    "// TODO: split the owner",
    "/* FIXME: preserve the transaction */",
    " * HACK: temporary compatibility path",
    "// XXX remove after migration",
  ])("counts an explicit debt comment: %s", (line) => {
    expect(isDebtMarkerComment(line)).toBe(true);
  });
});

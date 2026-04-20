import { describe, expect, it } from "vitest";

import {
  decodeHabitCompletionFromCloud,
  encodeHabitCompletionForCloud,
} from "../habitCompletionCodec";

describe("habitCompletionCodec", () => {
  describe("encodeHabitCompletionForCloud", () => {
    it("encodes boolean completions as a simple count", () => {
      expect(
        encodeHabitCompletionForCloud({
          habitType: "boolean",
          entryValue: 2,
        }),
      ).toEqual({
        count: 1,
        duration: null,
      });
    });

    it("preserves sub-unit numerical values via duration", () => {
      expect(
        encodeHabitCompletionForCloud({
          habitType: "numerical",
          entryValue: 250,
        }),
      ).toEqual({
        count: 1,
        duration: 250,
      });
    });

    it("preserves exact one-unit numerical values without collapsing them to boolean semantics", () => {
      expect(
        encodeHabitCompletionForCloud({
          habitType: "numerical",
          entryValue: 1000,
        }),
      ).toEqual({
        count: 1,
        duration: 1000,
      });
    });
  });

  describe("decodeHabitCompletionFromCloud", () => {
    it("decodes boolean rows as YES_MANUAL", () => {
      expect(
        decodeHabitCompletionFromCloud({
          habitType: "boolean",
          count: 7,
          duration: null,
        }),
      ).toBe(2);
    });

    it("prefers exact duration payload for numerical rows", () => {
      expect(
        decodeHabitCompletionFromCloud({
          habitType: "numerical",
          count: 3,
          duration: 2750,
        }),
      ).toBe(2750);
    });

    it("falls back to legacy count mapping for old numerical rows", () => {
      expect(
        decodeHabitCompletionFromCloud({
          habitType: "numerical",
          count: 2,
          duration: null,
        }),
      ).toBe(2000);
    });

    it("treats legacy count=1 numerical rows as one exact unit, not a boolean completion", () => {
      expect(
        decodeHabitCompletionFromCloud({
          habitType: "numerical",
          count: 1,
          duration: null,
        }),
      ).toBe(1000);
    });
  });
});

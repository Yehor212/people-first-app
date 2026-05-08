import { describe, expect, it } from "vitest";

import {
  decodeHabitCompletionFromCloud,
  encodeHabitCompletionForCloud,
  getCloudHabitCompletionSemanticFieldsForSync,
  getCloudHabitTypeForSync,
  isHabitEntrySyncableToCloud,
} from "../habitCompletionCodec";

describe("habitCompletionCodec", () => {
  describe("encodeHabitCompletionForCloud", () => {
    it("encodes boolean completions as a simple count", () => {
      expect(
        encodeHabitCompletionForCloud({
          habitType: "boolean",
          entryValue: 2,
        })
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
        })
      ).toEqual({
        count: 1,
        duration: 250,
      });
    });

    it("preserves exact zero for reduce/atMost numerical habits", () => {
      expect(
        encodeHabitCompletionForCloud({
          habitType: "numerical",
          entryValue: 0,
        })
      ).toEqual({
        count: 0,
        duration: 0,
      });
    });

    it("preserves exact one-unit numerical values without collapsing them to boolean semantics", () => {
      expect(
        encodeHabitCompletionForCloud({
          habitType: "numerical",
          entryValue: 1000,
        })
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
        })
      ).toBe(2);
    });

    it("prefers exact duration payload for numerical rows", () => {
      expect(
        decodeHabitCompletionFromCloud({
          habitType: "numerical",
          count: 3,
          duration: 2750,
        })
      ).toBe(2750);
    });

    it("prefers V2 entry value over legacy duration/count fields", () => {
      expect(
        decodeHabitCompletionFromCloud({
          habitType: "numerical",
          count: 3,
          duration: 3000,
          entryValue: 1750,
        })
      ).toBe(1750);
    });

    it("round-trips exact zero numerical rows", () => {
      expect(
        decodeHabitCompletionFromCloud({
          habitType: "numerical",
          count: 0,
          duration: 0,
        })
      ).toBe(0);
    });

    it("falls back to legacy count mapping for old numerical rows", () => {
      expect(
        decodeHabitCompletionFromCloud({
          habitType: "numerical",
          count: 2,
          duration: null,
        })
      ).toBe(2000);
    });

    it("treats legacy count=1 numerical rows as one exact unit, not a boolean completion", () => {
      expect(
        decodeHabitCompletionFromCloud({
          habitType: "numerical",
          count: 1,
          duration: null,
        })
      ).toBe(1000);
    });
  });

  describe("isHabitEntrySyncableToCloud", () => {
    it("syncs only manual boolean completions", () => {
      expect(
        isHabitEntrySyncableToCloud({
          habitType: "boolean",
          entryValue: 2,
        })
      ).toBe(true);
      expect(
        isHabitEntrySyncableToCloud({
          habitType: "boolean",
          entryValue: 1,
        })
      ).toBe(false);
      expect(
        isHabitEntrySyncableToCloud({
          habitType: "boolean",
          entryValue: 3,
        })
      ).toBe(false);
    });

    it("does not sync numerical skips as progress", () => {
      expect(
        isHabitEntrySyncableToCloud({
          habitType: "numerical",
          targetType: "atLeast",
          entryValue: 3,
        })
      ).toBe(false);
    });

    it("syncs explicit zero only for atMost habits", () => {
      expect(
        isHabitEntrySyncableToCloud({
          habitType: "numerical",
          targetType: "atMost",
          entryValue: 0,
        })
      ).toBe(true);
      expect(
        isHabitEntrySyncableToCloud({
          habitType: "numerical",
          targetType: "atLeast",
          entryValue: 0,
        })
      ).toBe(false);
    });
  });

  describe("getCloudHabitTypeForSync", () => {
    it("keeps atMost numerical habits in the cloud reduce bucket", () => {
      expect(
        getCloudHabitTypeForSync({
          habitType: "numerical",
          targetType: "atMost",
        })
      ).toBe("reduce");
    });
  });

  describe("getCloudHabitCompletionSemanticFieldsForSync", () => {
    it("marks completed numerical entries as complete with exact entry value", () => {
      expect(
        getCloudHabitCompletionSemanticFieldsForSync({
          habitType: "numerical",
          targetType: "atLeast",
          entryValue: 2500,
          isComplete: true,
        })
      ).toEqual({
        entry_value: 2500,
        entry_status: "completed",
        is_complete: true,
        habit_type: "numerical",
        target_type: "atLeast",
      });
    });

    it("marks below-target atLeast entries as partial, not completed", () => {
      expect(
        getCloudHabitCompletionSemanticFieldsForSync({
          habitType: "numerical",
          targetType: "atLeast",
          entryValue: 500,
          isComplete: false,
        })
      ).toMatchObject({
        entry_status: "partial",
        is_complete: false,
      });
    });

    it("marks over-limit atMost entries separately from ordinary partial progress", () => {
      expect(
        getCloudHabitCompletionSemanticFieldsForSync({
          habitType: "numerical",
          targetType: "atMost",
          entryValue: 5000,
          isComplete: false,
        })
      ).toMatchObject({
        entry_status: "over_limit",
        is_complete: false,
      });
    });
  });
});

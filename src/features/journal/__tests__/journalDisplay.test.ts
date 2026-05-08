import { describe, expect, it } from "vitest";

import {
  getJournalDisplayText,
  getJournalEditorContent,
  getJournalPreviewText,
} from "../journalDisplay";

const tx = {
  orbCapturedAt: "Captured at {time}",
};

describe("journalDisplay", () => {
  it("removes legacy captured-at HTML from entry detail text", () => {
    expect(
      getJournalDisplayText("<p><strong>Captured at 12:31</strong></p><p>прапра</p>", tx)
    ).toBe("прапра");
  });

  it("keeps user text clean when an old generated entry is opened in the editor", () => {
    expect(getJournalEditorContent("<p><strong>Captured at 12:31</strong></p><p>прапра</p>")).toBe(
      "<p>прапра</p>"
    );
  });

  it("converts HTML previews to readable localized text without raw tags", () => {
    expect(getJournalPreviewText("<p><strong>Captured at 12:31</strong></p><p>прапра</p>", tx)).toBe(
      "Captured at 12:31 прапра"
    );
  });
});

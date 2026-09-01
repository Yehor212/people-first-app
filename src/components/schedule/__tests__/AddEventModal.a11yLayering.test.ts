import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/components/schedule/AddEventModal.tsx", "utf8");

describe("AddEventModal Android layering and labels", () => {
  it("portals the modal above the global phone navigation trigger", () => {
    expect(source).toContain('import { createPortal } from "react-dom";');
    expect(source).toContain('data-testid="add-event-modal"');
    expect(source).toContain("createPortal(modal, document.body)");
  });

  it("binds every free-text field and date selector to a real label", () => {
    for (const id of ["eventDateSelectId", "eventTitleInputId", "eventNoteInputId"]) {
      expect(source).toContain(`const ${id} = useId();`);
      expect(source).toContain(`htmlFor={${id}}`);
      expect(source).toContain(`id={${id}}`);
    }
  });
});

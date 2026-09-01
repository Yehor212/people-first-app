import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const formSource = readFileSync(
  "src/components/habit-creation-form/HabitCreationForm.tsx",
  "utf8",
);

describe("HabitCreationForm template focus ownership", () => {
  it("does not summon the Android IME for an already named template", () => {
    expect(formSource).toContain("autoFocus={!selectedTemplateId}");
  });

  it("does not override Android IME focus scrolling with a delayed centered scroll", () => {
    expect(formSource).not.toContain(
      'el.scrollIntoView({ behavior: "smooth", block: "center" })',
    );
  });

  it("binds the habit-name field to a real label for Android accessibility", () => {
    expect(formSource).toContain("const habitNameInputId = useId();");
    expect(formSource).toContain('htmlFor={habitNameInputId}');
    expect(formSource).toContain('id={habitNameInputId}');
    expect(formSource).toContain('{ts.habitName}</label>');
  });
});

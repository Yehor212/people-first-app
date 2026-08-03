import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RemindersSection } from "../RemindersSection";

const copy = {
  reminders: "Reminders",
  addReminder: "Add reminder",
  noReminders: "No reminders",
  habitReminderTime: "Reminder time",
  delete: "Delete",
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
  habitReminderAtLeastOneDay:
    "Keep at least one day selected. To turn this reminder off, remove it.",
};

describe("RemindersSection reminder-day contract", () => {
  it("renders a legacy empty day list as a daily reminder", () => {
    render(
      <RemindersSection
        isPrimaryCTA={false}
        t={copy}
        reminders={[{ enabled: true, time: "09:00", days: [] }]}
        handleAddReminder={vi.fn()}
        handleRemoveReminder={vi.fn()}
        handleReminderChange={vi.fn()}
      />,
    );

    for (const label of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
      expect(screen.getByRole("button", { name: label })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }
  });

  it("keeps the final day selected and explains how to turn the reminder off", () => {
    const handleReminderChange = vi.fn();
    render(
      <RemindersSection
        isPrimaryCTA={false}
        t={copy}
        reminders={[{ enabled: true, time: "09:00", days: [1] }]}
        handleAddReminder={vi.fn()}
        handleRemoveReminder={vi.fn()}
        handleReminderChange={handleReminderChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mon" }));

    expect(handleReminderChange).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Keep at least one day selected. To turn this reminder off, remove it.",
    );
  });
});

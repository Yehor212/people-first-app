import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Translations } from "@/i18n/translations";
import { TaskFocusPanel } from "../TaskFocusPanel";

describe("TaskFocusPanel accessibility", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("isolates mixed-direction task names and localizes visible time", () => {
    const start = new Date(2026, 6, 29, 13, 5);
    vi.spyOn(Date, "now").mockReturnValue(start.getTime());
    render(
      <TaskFocusPanel
        language="ar"
        tasks={[
          {
            id: "task-1",
            name: "مراجعة Q3 @sam",
            urgent: false,
            estimatedMinutes: 25,
            completed: false,
          },
        ]}
        t={
          {
            yourTasksNow: "مهامك الآن",
            min: "د",
          } as Translations
        }
      />
    );

    expect(screen.getByText("مراجعة Q3 @sam")).toHaveAttribute("dir", "auto");
    const end = new Date(start.getTime() + 25 * 60_000);
    const formatter = new Intl.DateTimeFormat("ar", {
      hour: "2-digit",
      minute: "2-digit",
    });
    expect(
      screen.getByText(
        `${formatter.format(start)} — ${formatter.format(end)}`,
        { exact: false }
      )
    ).toBeInTheDocument();
  });
});

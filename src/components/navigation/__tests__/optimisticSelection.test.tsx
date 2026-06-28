import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BottomTabs } from "../BottomTabs";
import { Sidebar } from "../Sidebar";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      home: "Головна",
      diary: "Щоденник",
      stats: "Статистика",
      settings: "Налаштування",
      habitHub: "Звички",
      mainNavigation: "Основна навігація",
    },
  }),
}));

vi.mock("@/lib/haptics", () => ({
  haptics: {
    tabChanged: vi.fn(),
  },
}));

vi.mock("@/lib/safeJson", () => ({
  storageGetRaw: vi.fn(() => ""),
  storageSetRaw: vi.fn(),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe("classic navigation optimistic selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks the clicked desktop sidebar tab selected before the parent rerenders", () => {
    const onTabChange = vi.fn();

    render(<Sidebar activeTab="home" onTabChange={onTabChange} habitHubEnabled />);

    const home = screen.getByRole("tab", { name: "Головна" });
    const habits = screen.getByRole("tab", { name: "Звички" });

    expect(home).toHaveAttribute("aria-selected", "true");
    expect(habits).toHaveAttribute("aria-selected", "false");

    fireEvent.click(habits);

    expect(onTabChange).toHaveBeenCalledWith("mindmap");
    expect(habits).toHaveAttribute("aria-selected", "true");
    expect(home).toHaveAttribute("aria-selected", "false");
  });

  it("marks the clicked mobile bottom tab selected before the parent rerenders", () => {
    const onTabChange = vi.fn();

    render(<BottomTabs activeTab="home" onTabChange={onTabChange} habitHubEnabled />);

    const home = screen.getByRole("tab", { name: "Головна" });
    const habits = screen.getByRole("tab", { name: "Звички" });

    expect(home).toHaveAttribute("aria-selected", "true");
    expect(habits).toHaveAttribute("aria-selected", "false");

    fireEvent.click(habits);

    expect(onTabChange).toHaveBeenCalledWith("mindmap");
    expect(habits).toHaveAttribute("aria-selected", "true");
    expect(home).toHaveAttribute("aria-selected", "false");
  });
});

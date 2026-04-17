import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileNavV2 } from "../MobileNavV2";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      navV2Orb: "Orb",
      navV2Habits: "Habits",
      navV2Diary: "Diary",
      navV2Settings: "Settings",
      navV2PrimaryNav: "Primary navigation",
      habits: "Habits",
      diary: "Diary",
      settings: "Settings",
    },
    isRTL: false,
  }),
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { tabChanged: vi.fn(), selection: vi.fn() },
}));

describe("MobileNavV2", () => {
  const defaultProps = {
    activePage: "orb" as const,
    onPageChange: vi.fn(),
  };

  it("renders all 4 tabs", () => {
    render(<MobileNavV2 {...defaultProps} />);
    expect(screen.getByTestId("mobile-nav-v2-tab-orb")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-nav-v2-tab-habits")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-nav-v2-tab-diary")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-nav-v2-tab-settings")).toBeInTheDocument();
  });

  it("marks the active tab with aria-selected=true and aria-current=page", () => {
    render(<MobileNavV2 {...defaultProps} activePage="habits" />);
    const habits = screen.getByTestId("mobile-nav-v2-tab-habits");
    expect(habits).toHaveAttribute("aria-selected", "true");
    expect(habits).toHaveAttribute("aria-current", "page");
    const orb = screen.getByTestId("mobile-nav-v2-tab-orb");
    expect(orb).toHaveAttribute("aria-selected", "false");
  });

  it("enforces minimum 44px touch target via min-h on each tab button", () => {
    render(<MobileNavV2 {...defaultProps} />);
    const tab = screen.getByTestId("mobile-nav-v2-tab-orb");
    expect(tab.className).toMatch(/min-h-\[(44|48|52)px\]/);
  });

  it("uses safe-area-inset-bottom via Tailwind arbitrary value for iOS notch/home indicator", () => {
    render(<MobileNavV2 {...defaultProps} />);
    const nav = screen.getByTestId("mobile-nav-v2");
    expect(nav.className).toContain("safe-area-inset-bottom");
  });

  it("returns null when hidden=true (e.g. keyboard open)", () => {
    render(<MobileNavV2 {...defaultProps} hidden={true} />);
    expect(screen.queryByTestId("mobile-nav-v2")).not.toBeInTheDocument();
  });

  it("calls onPageChange on tab click", () => {
    const onPageChange = vi.fn();
    render(<MobileNavV2 {...defaultProps} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByTestId("mobile-nav-v2-tab-diary"));
    expect(onPageChange).toHaveBeenCalledWith("diary");
  });
});

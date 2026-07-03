import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileNavV2 } from "../MobileNavV2";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      navV2Orb: "Orb",
      navV2Habits: "Habits",
      navV2Diary: "Diary",
      navV2Planning: "Planning",
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

  it("renders all 5 navigation destinations", () => {
    render(<MobileNavV2 {...defaultProps} />);
    expect(screen.getByTestId("mobile-nav-v2-tab-orb")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-nav-v2-tab-habits")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-nav-v2-tab-diary")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-nav-v2-tab-planning")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-nav-v2-tab-settings")).toBeInTheDocument();
  });

  it("uses plain navigation buttons instead of incomplete tabs semantics", () => {
    render(<MobileNavV2 {...defaultProps} activePage="habits" />);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    const habits = screen.getByTestId("mobile-nav-v2-tab-habits");
    expect(habits).not.toHaveAttribute("role", "tab");
    expect(habits).not.toHaveAttribute("aria-selected");
    expect(habits).toHaveAttribute("aria-current", "page");
    const orb = screen.getByTestId("mobile-nav-v2-tab-orb");
    expect(orb).not.toHaveAttribute("aria-current");
  });

  it("enforces minimum 44px touch target via min-h on each tab button", () => {
    render(<MobileNavV2 {...defaultProps} />);
    const tab = screen.getByTestId("mobile-nav-v2-tab-orb");
    expect(tab.className).toMatch(/min-h-\[(44|48|52)px\]/);
  });

  it("gives mobile tabs a modern pressable affordance contract", () => {
    render(<MobileNavV2 {...defaultProps} activePage="settings" />);

    const settings = screen.getByTestId("mobile-nav-v2-tab-settings");
    const habits = screen.getByTestId("mobile-nav-v2-tab-habits");

    expect(settings).toHaveAttribute("data-nav-button", "mobile-tab");
    expect(settings.className).toContain("active:translate-y-[1px]");
    expect(settings.className).toContain("shadow-[");
    expect(habits).toHaveAttribute("data-nav-button", "mobile-tab");
  });

  it("uses safe-area-inset-bottom via Tailwind arbitrary value for iOS notch/home indicator", () => {
    render(<MobileNavV2 {...defaultProps} />);
    const nav = screen.getByTestId("mobile-nav-v2");
    expect(nav.className).toContain("--safe-bottom");
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

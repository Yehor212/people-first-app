import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DrawerV2 } from "../DrawerV2";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      navV2Menu: "Menu",
      navV2CloseMenu: "Close menu",
      navV2Search: "Search",
      navV2Theme: "Theme",
      navV2Archive: "Archive",
      navV2Account: "Account",
    },
    isRTL: false,
  }),
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { tabChanged: vi.fn(), selection: vi.fn() },
}));

describe("DrawerV2", () => {
  const baseProps = {
    open: true,
    onClose: vi.fn(),
    onOpenCommandPalette: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when open=false", () => {
    render(<DrawerV2 {...baseProps} open={false} />);
    expect(screen.queryByTestId("drawer-v2")).not.toBeInTheDocument();
  });

  it("renders drawer dialog + backdrop when open=true", () => {
    render(<DrawerV2 {...baseProps} />);
    expect(screen.getByTestId("drawer-v2")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-v2-backdrop")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-v2")).toHaveAttribute("role", "dialog");
    expect(screen.getByTestId("drawer-v2")).toHaveAttribute("aria-modal", "true");
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<DrawerV2 {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("drawer-v2-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<DrawerV2 {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close menu"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes and invokes onOpenCommandPalette when Search action is tapped", () => {
    const onClose = vi.fn();
    const onOpenCommandPalette = vi.fn();
    render(
      <DrawerV2
        {...baseProps}
        onClose={onClose}
        onOpenCommandPalette={onOpenCommandPalette}
      />,
    );
    fireEvent.click(screen.getByTestId("drawer-v2-action-command-palette"));
    expect(onClose).toHaveBeenCalled();
    expect(onOpenCommandPalette).toHaveBeenCalled();
  });

  it("renders secondary action buttons with disabled state when handler missing", () => {
    render(<DrawerV2 {...baseProps} />);
    const themeBtn = screen.getByTestId("drawer-v2-action-theme");
    expect(themeBtn).toBeDisabled();
    const archiveBtn = screen.getByTestId("drawer-v2-action-archive");
    expect(archiveBtn).toBeDisabled();
  });

  it("closes on Escape key press", () => {
    const onClose = vi.fn();
    render(<DrawerV2 {...baseProps} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

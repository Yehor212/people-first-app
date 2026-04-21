import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ConsentBanner } from "@/components/ConsentBanner";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: {} }),
}));

vi.mock("@/hooks/useModalKeyboard", () => ({
  useModalKeyboard: () => ({
    modalRef: { current: null },
    handleKeyDown: vi.fn(),
  }),
}));

vi.mock("@/hooks/useBackHandler", () => ({
  useBackHandler: vi.fn(),
}));

describe("ConsentBanner", () => {
  it("uses the modal overlay z-index token for the backdrop layer", () => {
    render(<ConsentBanner onConsent={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "Privacy Settings" });
    expect(dialog.parentElement).toHaveStyle({ zIndex: "var(--z-modal-overlay)" });
  });
});

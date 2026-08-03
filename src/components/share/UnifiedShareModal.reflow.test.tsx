import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UnifiedShareModal } from "@/components/share/UnifiedShareModal";
import { fr } from "@/i18n/languages/fr";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: fr, language: "fr" }),
}));

vi.mock("@/components/ThemeToggle", () => ({
  useTheme: () => ({ effectiveTheme: "light" }),
}));

vi.mock("@/hooks/useBackHandler", () => ({
  useBackHandler: vi.fn(),
}));

vi.mock("@/hooks/useScrollLock", () => ({
  useScrollLock: vi.fn(),
}));

vi.mock("@/hooks/useShareFlow", () => ({
  useShareFlow: () => ({
    status: "success",
    imageUrl: "data:image/png;base64,",
    imageBlob: new Blob([], { type: "image/png" }),
    error: null,
    lastAction: "download",
    generate: vi.fn(),
    download: vi.fn(),
    copy: vi.fn(),
    share: vi.fn(),
  }),
}));

describe("UnifiedShareModal secondary action reflow", () => {
  it("keeps the complete French download status outside stable, wrapping action labels", () => {
    render(
      <UnifiedShareModal
        open
        onOpenChange={vi.fn()}
        mode="streak"
        streak={7}
      />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(fr.imageSaved);

    const download = screen.getByRole("button", { name: fr.shareDownload });
    const copy = screen.getByRole("button", { name: fr.shareCopyLink });
    const actions = download.parentElement;

    expect(actions).toHaveClass(
      "grid",
      "grid-cols-[repeat(auto-fit,minmax(min(100%,calc(8rem*var(--font-scale,1))),1fr))]",
    );

    expect(download).toHaveTextContent(fr.shareDownload);
    expect(download).not.toHaveTextContent(fr.imageSaved);

    for (const action of [download, copy]) {
      expect(action).toHaveClass("h-auto", "min-h-12", "min-w-0", "px-3", "py-2");
    }

    for (const label of [
      within(download).getByText(fr.shareDownload),
      within(copy).getByText(fr.shareCopyLink),
    ]) {
      expect(label).toHaveClass(
        "min-w-0",
        "whitespace-normal",
        "break-words",
        "[hyphens:manual]",
        "[overflow-wrap:break-word]",
      );
    }
  });
});

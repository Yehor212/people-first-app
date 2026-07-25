import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("virtual:changelog", () => ({
  default: [
    {
      version: "9.9.9",
      codename: "Coverage proof",
      date: "2026-07-16",
      sections: [
        {
          title: "Added",
          items: ["A real rendered changelog entry"],
        },
      ],
    },
    {
      version: "9.9.8",
      date: "2026-07-15",
      sections: [
        {
          title: "Fixed",
          items: ["A second rendered changelog entry"],
        },
      ],
    },
  ],
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      changelogTitle: "Version History",
      changelogExpandAll: "Expand All",
      changelogCollapseAll: "Collapse All",
      changelogAdded: "Added",
      changelogFixed: "Fixed",
      close: "Close",
    },
  }),
}));

vi.mock("@/hooks/useModalA11y", () => ({
  useModalA11y: () => ({
    modalRef: createRef<HTMLDivElement>(),
    handleKeyDown: vi.fn(),
  }),
}));

vi.mock("@/hooks/useScrollLock", () => ({
  useScrollLock: vi.fn(),
}));

import { ChangelogPanel } from "../ChangelogPanel";

const source = readFileSync(resolve(process.cwd(), "src/components/ChangelogPanel.tsx"), "utf8");

describe("ChangelogPanel viewport contract", () => {
  it("renders at the viewport root when opened from a transformed settings surface", () => {
    expect(source).toContain('from "react-dom"');
    expect(source).toContain("createPortal(");
    expect(source).toContain("document.body");
    expect(source).toContain("open: boolean");
    expect(source).toContain("useModalA11y(open, onClose)");
    expect(source).toContain("ref={modalRef}");
    expect(source).toContain("onKeyDown={handleKeyDown}");
  });

  it("renders the virtual changelog through the real component module", () => {
    const onClose = vi.fn();

    render(<ChangelogPanel open onClose={onClose} />);

    expect(screen.getByRole("dialog", { name: "Version History" })).toBeInTheDocument();
    expect(screen.getByText("v9.9.9")).toBeInTheDocument();
    expect(screen.getByText("A real rendered changelog entry")).toBeInTheDocument();
    expect(screen.queryByText("A second rendered changelog entry")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /v9\.9\.9/i }));
    expect(screen.queryByText("A real rendered changelog entry")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand All" }));
    expect(screen.getByText("A real rendered changelog entry")).toBeInTheDocument();
    expect(screen.getByText("A second rendered changelog entry")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse All" }));
    expect(screen.queryByText("A real rendered changelog entry")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

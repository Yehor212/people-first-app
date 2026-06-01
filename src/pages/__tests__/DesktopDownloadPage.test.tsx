import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DesktopDownloadPage } from "../DesktopDownloadPage";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "en" }),
}));

vi.mock("@/hooks/useShouldAnimate", () => ({
  useShouldAnimate: () => true,
}));

vi.mock("@/components/state-of-mind/MiniValenceOrb", () => ({
  MiniValenceOrb: ({ size, chrome }: { size?: string; chrome?: string }) => (
    <div data-chrome={chrome} data-size={size} data-testid="canonical-mini-orb" />
  ),
}));

describe("DesktopDownloadPage", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps public EXE download locked until a signed release is ready", () => {
    render(<DesktopDownloadPage />);

    expect(screen.getByTestId("desktop-download-page")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Signed EXE is being prepared/i })).toBeDisabled();
    expect(screen.queryByRole("link", { name: /Download signed EXE/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /GitHub Releases/i })).toHaveAttribute(
      "href",
      "https://github.com/Yehor212/people-first-app/releases",
    );
  });

  it("shows the download link only for a verified signed release configuration", () => {
    vi.stubEnv(
      "VITE_DESKTOP_SIGNED_RELEASE_URL",
      "https://github.com/Yehor212/people-first-app/releases/download/desktop-v2.0.0/ZenFlow_2.0.0_x64-setup.exe",
    );
    vi.stubEnv("VITE_DESKTOP_SIGNED_RELEASE_SHA256", "B".repeat(64));
    vi.stubEnv("VITE_DESKTOP_SIGNED_RELEASE_AUTHENTICODE", "Valid");

    render(<DesktopDownloadPage />);

    expect(screen.getByRole("link", { name: /Download signed EXE/i })).toHaveAttribute(
      "href",
      "https://github.com/Yehor212/people-first-app/releases/download/desktop-v2.0.0/ZenFlow_2.0.0_x64-setup.exe",
    );
    expect(screen.queryByRole("button", { name: /Signed EXE is being prepared/i })).not.toBeInTheDocument();
  });

  it("uses the canonical mini orb on the Desktop Dock visual surface", () => {
    render(<DesktopDownloadPage />);

    const canonicalOrbs = screen.getAllByTestId("canonical-mini-orb");

    expect(canonicalOrbs.length).toBeGreaterThanOrEqual(2);
    expect(canonicalOrbs.some((orb) => orb.dataset.size === "lg")).toBe(true);
    expect(canonicalOrbs.some((orb) => orb.dataset.chrome === "badge")).toBe(true);
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      errorBoundaryTitle: "Щось пішло не так",
      errorBoundaryBody: "Спробуйте перезавантажити додаток.",
      errorBoundaryKicker: "Режим відновлення ZenFlow",
      errorBoundaryReload: "Перезавантажити",
    },
  }),
}));

vi.mock("@/lib/crashReporting", () => ({
  crashReporting: {
    recordError: vi.fn(),
  },
}));

vi.mock("@/lib/sentry", () => ({
  captureError: vi.fn(),
}));

vi.mock("@/lib/errorBuffer", () => ({
  captureOrBuffer: vi.fn(),
}));

import { captureOrBuffer } from "@/lib/errorBuffer";
import { ErrorBoundary } from "../ErrorBoundary";

function Thrower(): ReactElement {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    document.documentElement.dataset.deviceTier = "phone";
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete document.documentElement.dataset.deviceTier;
  });

  it("renders the polished recovery state with localized copy", async () => {
    render(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>,
    );

    expect(await screen.findByTestId("error-boundary-card")).toBeInTheDocument();
    expect(screen.getByTestId("recovery-infinity-loader")).toBeInTheDocument();
    expect(screen.getByText("Режим відновлення ZenFlow")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Щось пішло не так" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Експортувати звіт" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Перезавантажити" })).toHaveClass(
      "min-h-[48px]",
    );

    await waitFor(() => expect(captureOrBuffer).toHaveBeenCalledTimes(1));
    expect(captureOrBuffer).toHaveBeenCalledWith(
      expect.objectContaining({ message: "boom" }),
      expect.objectContaining({ context: "ErrorBoundary" }),
    );
  });

  afterAll(() => {
    consoleError.mockRestore();
  });
});

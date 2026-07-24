import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockForceHardReload = vi.fn().mockResolvedValue(undefined);
const mockReloadAppSafely = vi.fn().mockResolvedValue(undefined);

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      errorBoundaryTitle: "Щось пішло не так",
      errorBoundaryBody: "Спробуйте перезавантажити додаток.",
      errorBoundaryKicker: "Режим відновлення ZenFlow",
      errorBoundaryReload: "Перезавантажити",
      errorBoundaryReloadFailed: "Не вдалося безпечно перезавантажити. Спробуйте ще раз.",
      failedToLoad: "Не вдалося завантажити",
      failedToLoadBody: "Компонент не вдалося завантажити. Спробуйте оновити сторінку.",
      tryAgain: "Спробувати знову",
      close: "Закрити",
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

vi.mock("@/lib/versionCheck", () => ({
  forceHardReload: (...args: unknown[]) => mockForceHardReload(...args),
  reloadAppSafely: (...args: unknown[]) => mockReloadAppSafely(...args),
}));

import { captureOrBuffer } from "@/lib/errorBuffer";
import { ErrorBoundary, LazyErrorBoundary } from "../ErrorBoundary";

function Thrower(): ReactElement {
  throw new Error("boom");
}

function ThrowChunkLoadError(): ReactElement {
  throw new Error(
    "Failed to fetch dynamically imported module: https://app.example/assets/TabContent-old.js",
  );
}

describe("ErrorBoundary", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    document.documentElement.dataset.deviceTier = "phone";
    mockForceHardReload.mockClear();
    mockReloadAppSafely.mockReset();
    mockReloadAppSafely.mockResolvedValue(undefined);
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
    expect(screen.getByText("Your data is safe").parentElement?.parentElement).toHaveClass(
      "text-start",
    );

    await waitFor(() => expect(captureOrBuffer).toHaveBeenCalledTimes(1));
    expect(captureOrBuffer).toHaveBeenCalledWith(
      expect.objectContaining({ message: "boom" }),
      expect.objectContaining({ context: "ErrorBoundary" }),
    );
  });

  it("uses the hard-reload recovery path for stale lazy chunks", async () => {
    render(
      <LazyErrorBoundary componentName="TabContent">
        <ThrowChunkLoadError />
      </LazyErrorBoundary>,
    );

    await waitFor(() => expect(mockForceHardReload).toHaveBeenCalledTimes(1));
  });

  it("shows a retryable error when durable recovery reload is blocked", async () => {
    mockReloadAppSafely.mockRejectedValueOnce(new Error("draft write failed"));
    render(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>,
    );

    const reload = await screen.findByRole("button", { name: "Перезавантажити" });
    fireEvent.click(reload);

    expect(
      await screen.findByRole("alert", {
        name: "Не вдалося безпечно перезавантажити. Спробуйте ще раз.",
      }),
    ).toBeInTheDocument();
    expect(reload).toBeEnabled();
  });

  afterAll(() => {
    consoleError.mockRestore();
  });
});

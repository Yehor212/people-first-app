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
import { SK } from "@/lib/storageKeys";
import {
  ErrorBoundary,
  LazyErrorBoundary,
  pruneRetainedBoundaryDiagnostics,
  retainBoundaryDiagnostic,
} from "../ErrorBoundary";

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
    window.localStorage.clear();
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

  it("retains only fixed diagnostics for a private boundary error", () => {
    const error = new Error("ZF_T172_DIARY_7H2K9Q4M6P8R") as Error & { cause?: unknown };
    error.cause = new Error("ZF_T172_AUTH_9B6W3J8S2F5K");
    retainBoundaryDiagnostic(error, "ZF_ERROR_BOUNDARY", { context: "ErrorBoundary" });

    const retained = window.localStorage.getItem(SK.ERROR_LOG) ?? "";
    expect(retained).not.toContain("ZF_T172_DIARY_7H2K9Q4M6P8R");
    expect(retained).not.toContain("ZF_T172_AUTH_9B6W3J8S2F5K");
    expect(retained).toContain("ZF_ERROR_BOUNDARY");
  });

  it("drops legacy and expired records and caps retained boundary diagnostics at ten", async () => {
    const current = Array.from({ length: 12 }, (_, index) => ({
      code: "ZF_ERROR_BOUNDARY",
      errorName: "Error",
      stackFingerprint: "stack-present",
      context: {},
      appVersion: "2.0.0",
      dataSchemaVersion: "11",
      time: new Date(Date.now() - index * 1_000).toISOString(),
    }));
    window.localStorage.setItem(SK.ERROR_LOG, JSON.stringify([
      { message: "legacy private error", time: new Date().toISOString() },
      {
        ...current[0],
        stackFingerprint: "stack-expired",
        time: new Date(Date.now() - 8 * 24 * 60 * 60 * 1_000).toISOString(),
      },
      ...current,
    ]));

    render(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>,
    );

    expect(await screen.findByTestId("error-boundary-card")).toBeInTheDocument();
    const retained = JSON.parse(window.localStorage.getItem(SK.ERROR_LOG) ?? "[]") as Array<{
      code: string;
      stackFingerprint: string;
    }>;
    expect(retained).toHaveLength(10);
    expect(JSON.stringify(retained)).not.toContain("legacy private error");
    expect(JSON.stringify(retained)).not.toContain("stack-expired");
    expect(retained.at(-1)?.code).toBe("ZF_ERROR_BOUNDARY");
  });

  it("prunes legacy boundary records without waiting for another render error", () => {
    window.localStorage.setItem(SK.ERROR_LOG, JSON.stringify([
      { message: "legacy private boundary error", time: new Date().toISOString() },
      {
        code: "ZF_ERROR_BOUNDARY",
        errorName: "Error",
        stackFingerprint: "stack-present",
        context: {},
        appVersion: "2.0.0",
        dataSchemaVersion: "11",
        time: new Date().toISOString(),
      },
    ]));

    expect(pruneRetainedBoundaryDiagnostics()).toBe(true);

    expect(JSON.parse(window.localStorage.getItem(SK.ERROR_LOG) ?? "[]")).toEqual([
      expect.objectContaining({ stackFingerprint: "stack-present" }),
    ]);
    expect(window.localStorage.getItem(SK.ERROR_LOG)).not.toContain("legacy private boundary error");
  });

  it("re-sanitizes poisoned fields in a current-schema boundary record", () => {
    const retainedCanary = "ZF_T172_RETAINED_BOUNDARY_5N8C3V7X2L4D";
    window.localStorage.setItem(SK.ERROR_LOG, JSON.stringify([{
      code: "ZF_ERROR_BOUNDARY",
      errorName: retainedCanary,
      stackFingerprint: `stack-${retainedCanary}`,
      context: {
        note: retainedCanary,
        metadata: { userId: retainedCanary },
      },
      appVersion: retainedCanary,
      dataSchemaVersion: retainedCanary,
      time: new Date().toISOString(),
    }]));

    expect(pruneRetainedBoundaryDiagnostics()).toBe(true);

    const retained = JSON.parse(window.localStorage.getItem(SK.ERROR_LOG) ?? "[]");
    expect(JSON.stringify(retained)).not.toContain(retainedCanary);
    expect(retained).toEqual([
      expect.objectContaining({
        code: "ZF_ERROR_BOUNDARY",
        errorName: "UnknownError",
        stackFingerprint: "stack-none",
        context: {
          note: "[REDACTED]",
          metadata: { userId: "[REDACTED]" },
        },
      }),
    ]);
  });

  it("clears a valid JSON non-array boundary payload instead of retaining it", () => {
    const retainedCanary = "ZF_T172_BOUNDARY_OBJECT_3P7M9K2R5V8Q";
    window.localStorage.setItem(SK.ERROR_LOG, JSON.stringify({
      code: "ZF_ERROR_BOUNDARY",
      note: retainedCanary,
    }));

    expect(pruneRetainedBoundaryDiagnostics()).toBe(true);
    expect(window.localStorage.getItem(SK.ERROR_LOG)).toBe("[]");
    expect(window.localStorage.getItem(SK.ERROR_LOG)).not.toContain(retainedCanary);
  });

  it("drops a poisoned boundary record with a far-future timestamp", () => {
    const retainedCanary = "ZF_T172_FUTURE_BOUNDARY_2N8V5K9M3R7Q";
    window.localStorage.setItem(SK.ERROR_LOG, JSON.stringify([{
      code: "ZF_ERROR_BOUNDARY",
      errorName: "Error",
      stackFingerprint: "stack-future",
      context: { note: retainedCanary },
      appVersion: "2.0.0",
      dataSchemaVersion: "11",
      time: new Date(Date.now() + 8 * 24 * 60 * 60 * 1_000).toISOString(),
    }]));

    expect(pruneRetainedBoundaryDiagnostics()).toBe(true);
    expect(window.localStorage.getItem(SK.ERROR_LOG)).toBe("[]");
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

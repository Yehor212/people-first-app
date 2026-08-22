import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Component, createElement, type ErrorInfo, type ReactNode } from "react";
import { render, waitFor } from "@testing-library/react";

class FrameworkBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {}

  render() {
    return this.state.failed ? createElement("div", null, "recovered") : this.props.children;
  }
}

describe("diagnostic console boundary", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("installs from a side-effect bootstrap before the React import graph", () => {
    const main = readFileSync(resolve(process.cwd(), "src/main.tsx"), "utf8");
    const bootstrapImport = 'import "./lib/diagnosticConsoleBootstrap";';
    const bootstrapIndex = main.indexOf(bootstrapImport);
    const reactIndex = main.indexOf('import { createRoot } from "react-dom/client";');

    expect(bootstrapIndex).toBeGreaterThanOrEqual(0);
    expect(bootstrapIndex).toBeLessThan(reactIndex);
    expect(
      readFileSync(resolve(process.cwd(), "src/lib/diagnosticConsoleBootstrap.ts"), "utf8"),
    ).toContain("installDiagnosticConsoleBoundary();");
  });

  it("replaces nested Error/cause/query payloads with a fixed framework code", async () => {
    const canary = "ZF_T172_REACT_CAUGHT_8R3M7K2V5Q9N";
    const originalError = console.error;
    const sink = vi.fn();
    const suppressBrowserDefault = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener("error", suppressBrowserDefault);
    console.error = sink;
    try {
      const { installDiagnosticConsoleBoundary } = await import("../diagnosticConsole");
      installDiagnosticConsoleBoundary();
      const error = new Error(`${canary}?code=${encodeURIComponent(canary)}`) as Error & {
        cause?: unknown;
      };
      error.cause = { nested: new Error(canary) };

      console.error(error, { cause: error.cause, url: `https://example.test/?code=${canary}` });

      const serialized = JSON.stringify(sink.mock.calls);
      expect(serialized).not.toContain(canary);
      expect(sink).toHaveBeenCalledWith(
        "ZF_FRAMEWORK_CONSOLE_ERROR",
        expect.objectContaining({
          error_name: "Error",
          stack_fingerprint: expect.stringMatching(/^stack-/),
        }),
        expect.objectContaining({ cause: "[REDACTED]", url: "[REDACTED]" }),
      );
    } finally {
      window.removeEventListener("error", suppressBrowserDefault);
      console.error = originalError;
    }
  });

  it("intercepts React caught-boundary console egress before raw canaries reach the sink", async () => {
    const messageCanary = "ZF_T172_REACT_MESSAGE_2f84c9a1";
    const causeCanary = "ZF_T172_REACT_CAUSE_7b31d6e4";
    const originalError = console.error;
    const sink = vi.fn();
    const suppressBrowserDefault = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener("error", suppressBrowserDefault);
    console.error = sink;
    try {
      const { installDiagnosticConsoleBoundary } = await import("../diagnosticConsole");
      installDiagnosticConsoleBoundary();
      const Thrower = () => {
        const error = new Error(messageCanary) as Error & { cause?: unknown };
        error.cause = new Error(`${causeCanary}?code=${encodeURIComponent(causeCanary)}`);
        throw error;
      };

      render(createElement(FrameworkBoundary, null, createElement(Thrower)));
      await waitFor(() => expect(document.body).toHaveTextContent("recovered"));

      const serialized = JSON.stringify(sink.mock.calls);
      expect(serialized).not.toContain(messageCanary);
      expect(serialized).not.toContain(causeCanary);
      expect(serialized).not.toContain(encodeURIComponent(causeCanary));
    } finally {
      window.removeEventListener("error", suppressBrowserDefault);
      console.error = originalError;
    }
  });
});

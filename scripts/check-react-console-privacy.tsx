#!/usr/bin/env -S NODE_ENV=production npx tsx

import { JSDOM, VirtualConsole } from "jsdom";
import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

import { installDiagnosticConsoleBoundary } from "../src/lib/diagnosticConsole";

const MESSAGE_CANARY = "ZF_T172_REACT_PROD_MESSAGE_18c7a4e2";
const CAUSE_CANARY = "ZF_T172_REACT_PROD_CAUSE_5d29b8f1";
let diagnosticStage = "start";

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {}

  render() {
    return this.state.failed ? <div id="recovered">recovered</div> : this.props.children;
  }
}

function Thrower(): ReactNode {
  const error = new Error(MESSAGE_CANARY) as Error & { cause?: unknown };
  error.cause = new Error(`${CAUSE_CANARY}?code=${encodeURIComponent(CAUSE_CANARY)}`);
  throw error;
}

async function main(): Promise<void> {
  diagnosticStage = "dom";
  const virtualConsole = new VirtualConsole();
  // Never forward JSDOM's diagnostic channel to the process evidence stream.
  virtualConsole.on("jsdomError", () => undefined);
  const dom = new JSDOM("<!doctype html><div id=\"root\"></div>", {
    url: "https://diagnostic.invalid/",
    virtualConsole,
  });
  const installGlobal = (key: string, value: unknown) => {
    Object.defineProperty(globalThis, key, { configurable: true, value, writable: true });
  };
  installGlobal("window", dom.window);
  installGlobal("document", dom.window.document);
  installGlobal("navigator", dom.window.navigator);
  installGlobal("HTMLElement", dom.window.HTMLElement);
  installGlobal("Node", dom.window.Node);
  installGlobal("Event", dom.window.Event);
  installGlobal("ErrorEvent", dom.window.ErrorEvent);

  const originalError = console.error;
  const sink: unknown[][] = [];
  console.error = (...args: unknown[]) => sink.push(args);
  dom.window.addEventListener("error", (event) => event.preventDefault());

  let recovered = false;
  try {
    diagnosticStage = "install";
    installDiagnosticConsoleBoundary();
    diagnosticStage = "render";
    const container = dom.window.document.getElementById("root");
    if (!container) throw new Error("ZF_REACT_PRIVACY_HARNESS_ROOT_MISSING");
    createRoot(container).render(
      <Boundary>
        <Thrower />
      </Boundary>,
    );
    diagnosticStage = "settle";
    await new Promise((resolve) => setTimeout(resolve, 25));
    recovered = Boolean(dom.window.document.getElementById("recovered"));
  } finally {
    console.error = originalError;
    dom.window.close();
  }

  const serialized = JSON.stringify(sink);
  const result = {
    runtime: process.env.NODE_ENV === "production" ? "production" : "unexpected",
    recovered,
    consoleErrorCalls: sink.length,
    rawMessage: serialized.includes(MESSAGE_CANARY),
    rawCause: serialized.includes(CAUSE_CANARY),
    fixedCode: serialized.includes("ZF_FRAMEWORK_CONSOLE_ERROR"),
    stage: diagnosticStage,
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (
    result.runtime !== "production" ||
    !result.recovered ||
    result.consoleErrorCalls < 1 ||
    result.rawMessage ||
    result.rawCause ||
    !result.fixedCode
  ) {
    process.exitCode = 1;
  }
}

void main().catch(() => {
  process.stdout.write(`${JSON.stringify({
    runtime: "production",
    result: "ZF_REACT_PRIVACY_HARNESS_FAILED",
    stage: diagnosticStage,
  })}\n`);
  process.exitCode = 1;
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

import {
  cleanupAutomationLifecycleFixture,
  readAutomationLifecycleSnapshot,
  seedAutomationLifecycleFixture,
  T146_AUTOMATION_LIFECYCLE_FIXTURE,
  T146_EXPECTED_AUTOMATION_LIFECYCLE_SNAPSHOT,
  type AutomationLifecycleSnapshot,
} from "../automation-lifecycle/indexedDbFixture";

const execFileAsync = promisify(execFile);
const PACKAGE_NAME = "com.zenflow.app";
const ACTIVITY_NAME = `${PACKAGE_NAME}/.MainActivity`;
const DEFAULT_APK = "android/app/build/outputs/apk/debug/app-debug.apk";
const DEFAULT_RECEIPT = "output/android21/automation-process-death-current.json";
const SAFE_SERIAL = /^[A-Za-z0-9._:-]+$/;
const SAFE_OUTPUT = /^output\/android21\/[A-Za-z0-9._/-]+\.json$/;
const WAIT_TIMEOUT_MS = 30_000;

type CdpResponse = {
  id?: number;
  result?: { result?: { value?: unknown }; exceptionDetails?: { text?: string } };
  error?: { message?: string };
};

class PageCdpClient {
  private nextId = 0;
  private readonly pending = new Map<number, (response: CdpResponse) => void>();

  private constructor(
    private readonly socket: WebSocket,
    private readonly expectedOrigin: string,
  ) {
    socket.addEventListener("message", (event) => {
      if (event.origin !== this.expectedOrigin) return;
      const response = JSON.parse(String(event.data)) as CdpResponse;
      if (typeof response.id !== "number") return;
      const resolvePending = this.pending.get(response.id);
      if (!resolvePending) return;
      this.pending.delete(response.id);
      resolvePending(response);
    });
  }

  static async connect(url: string): Promise<PageCdpClient> {
    if (typeof WebSocket === "undefined") {
      throw new Error("T146 Android smoke requires Node 22 WebSocket support");
    }
    const socket = new WebSocket(url);
    await new Promise<void>((resolveOpen, rejectOpen) => {
      socket.addEventListener("open", () => resolveOpen(), { once: true });
      socket.addEventListener("error", () => rejectOpen(new Error("Unable to connect to WebView CDP")), {
        once: true,
      });
    });
    return new PageCdpClient(socket, new URL(url).origin);
  }

  async evaluate<T>(expression: string): Promise<T> {
    const id = ++this.nextId;
    const responsePromise = new Promise<CdpResponse>((resolveResponse) => {
      this.pending.set(id, resolveResponse);
    });
    this.socket.send(
      JSON.stringify({
        id,
        method: "Runtime.evaluate",
        params: { expression, awaitPromise: true, returnByValue: true },
      }),
    );
    const response = await responsePromise;
    if (response.error?.message) throw new Error(response.error.message);
    if (response.result?.exceptionDetails) {
      throw new Error(response.result.exceptionDetails.text ?? "WebView evaluation failed");
    }
    return response.result?.result?.value as T;
  }

  close(): void {
    this.socket.close();
  }
}

function parseArguments(argv: readonly string[]): { serial: string; apkPath: string; receiptPath: string } {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) {
      throw new Error("Usage: --serial <adb-serial> [--apk <path>] [--receipt <output/android21/file.json>]");
    }
    values.set(key, value);
  }
  const serial = values.get("--serial") ?? process.env.ZENFLOW_ANDROID_SERIAL ?? "";
  const apkPath = values.get("--apk") ?? DEFAULT_APK;
  const receiptPath = values.get("--receipt") ?? DEFAULT_RECEIPT;
  if (!SAFE_SERIAL.test(serial)) throw new Error("A safe explicit Android emulator serial is required");
  if (!SAFE_OUTPUT.test(receiptPath) || receiptPath.includes("..")) {
    throw new Error("The receipt must stay under output/android21 and use a JSON filename");
  }
  if ([...values.keys()].some((key) => !["--serial", "--apk", "--receipt"].includes(key))) {
    throw new Error("Unknown T146 Android smoke argument");
  }
  return { serial, apkPath, receiptPath };
}

async function adb(serial: string, args: readonly string[]): Promise<string> {
  const { stdout } = await execFileAsync("adb", ["-s", serial, ...args], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout.trim();
}

async function waitFor<T>(description: string, read: () => Promise<T | null>): Promise<T> {
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const value = await read();
      if (value !== null) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Timed out waiting for ${description}`, { cause: lastError });
}

async function getPid(serial: string): Promise<string | null> {
  try {
    const value = await adb(serial, ["shell", "pidof", PACKAGE_NAME]);
    return /^\d+$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

async function startAndAttach(serial: string): Promise<{
  client: PageCdpClient;
  forwardPort: number;
  pid: string;
  targetUrl: string;
}> {
  await adb(serial, ["shell", "am", "start", "-n", ACTIVITY_NAME]);
  const pid = await waitFor("ZenFlow process", () => getPid(serial));
  await waitFor("WebView debugging socket", async () => {
    const sockets = await adb(serial, ["shell", "cat", "/proc/net/unix"]);
    return sockets.includes(`webview_devtools_remote_${pid}`) ? true : null;
  });
  const portText = await adb(serial, [
    "forward",
    "tcp:0",
    `localabstract:webview_devtools_remote_${pid}`,
  ]);
  const forwardPort = Number(portText);
  if (!Number.isInteger(forwardPort) || forwardPort <= 0) {
    throw new Error("ADB did not allocate a WebView forwarding port");
  }
  const target = await waitFor<{ webSocketDebuggerUrl: string; url: string }>(
    "WebView CDP page",
    async () => {
      const response = await fetch(`http://127.0.0.1:${forwardPort}/json`);
      if (!response.ok) return null;
      const targets = (await response.json()) as Array<{
        type?: string;
        url?: string;
        webSocketDebuggerUrl?: string;
      }>;
      const page = targets.find(
        (candidate) =>
          typeof candidate.webSocketDebuggerUrl === "string" && candidate.url === "https://localhost/",
      );
      return page?.webSocketDebuggerUrl
        ? { webSocketDebuggerUrl: page.webSocketDebuggerUrl, url: page.url ?? "" }
        : null;
    },
  );
  const client = await PageCdpClient.connect(target.webSocketDebuggerUrl);
  await waitFor("WebView document readiness", async () => {
    const readyState = await client.evaluate<string>("document.readyState");
    return readyState === "complete" ? readyState : null;
  });
  return { client, forwardPort, pid, targetUrl: target.url };
}

function browserCall<T>(
  operation: (fixture: typeof T146_AUTOMATION_LIFECYCLE_FIXTURE) => Promise<T>,
): string {
  return `(async () => { const __name = (value) => value; return (${operation.toString()})(${JSON.stringify(T146_AUTOMATION_LIFECYCLE_FIXTURE)}); })()`;
}

async function removeForward(serial: string, port: number | null): Promise<void> {
  if (port === null) return;
  try {
    await adb(serial, ["forward", "--remove", `tcp:${port}`]);
  } catch {
    // The exact local forward is disposable test infrastructure.
  }
}

async function sha256File(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function main(): Promise<void> {
  const { serial, apkPath, receiptPath } = parseArguments(process.argv.slice(2));
  const resolvedApk = resolve(apkPath);
  const resolvedReceipt = resolve(receiptPath);
  const deviceApi = await adb(serial, ["shell", "getprop", "ro.build.version.sdk"]);
  const deviceModel = await adb(serial, ["shell", "getprop", "ro.product.model"]);
  const packageState = await adb(serial, ["shell", "pm", "path", PACKAGE_NAME]);
  if (!packageState.startsWith("package:")) throw new Error(`${PACKAGE_NAME} is not installed on ${serial}`);

  let attachment = await startAndAttach(serial);
  let activeClient: PageCdpClient | null = attachment.client;
  let activeForwardPort: number | null = attachment.forwardPort;
  let seeded = false;
  try {
    const cleanupBefore = await activeClient.evaluate<{ remaining: number }>(
      browserCall(cleanupAutomationLifecycleFixture),
    );
    assert.equal(cleanupBefore.remaining, 0, "pre-existing T146 fixture keys must be removable");
    const seededResult = await activeClient.evaluate<{ databaseVersion: number }>(
      browserCall(seedAutomationLifecycleFixture),
    );
    assert.equal(
      seededResult.databaseVersion,
      T146_AUTOMATION_LIFECYCLE_FIXTURE.expectedDatabaseVersion,
      "Android WebView must open the v11 ZenFlowDB schema",
    );
    seeded = true;
    const before = await activeClient.evaluate<AutomationLifecycleSnapshot>(
      browserCall(readAutomationLifecycleSnapshot),
    );
    assert.deepEqual(before, T146_EXPECTED_AUTOMATION_LIFECYCLE_SNAPSHOT);

    const oldPid = attachment.pid;
    activeClient.close();
    activeClient = null;
    await removeForward(serial, activeForwardPort);
    activeForwardPort = null;
    await adb(serial, ["shell", "am", "force-stop", PACKAGE_NAME]);
    await waitFor("old ZenFlow process termination", async () =>
      (await getPid(serial)) === null ? true : null,
    );

    attachment = await startAndAttach(serial);
    activeClient = attachment.client;
    activeForwardPort = attachment.forwardPort;
    assert.notEqual(attachment.pid, oldPid, "force-stop must create a new Android process");
    const after = await activeClient.evaluate<AutomationLifecycleSnapshot>(
      browserCall(readAutomationLifecycleSnapshot),
    );
    assert.deepEqual(after, T146_EXPECTED_AUTOMATION_LIFECYCLE_SNAPSHOT);
    assert.deepEqual(after, before, "the exact connected-record boundary must survive process death");

    const cleanupAfter = await activeClient.evaluate<{ remaining: number }>(
      browserCall(cleanupAutomationLifecycleFixture),
    );
    assert.equal(cleanupAfter.remaining, 0, "T146 cleanup must remove every exact fixture key");
    seeded = false;

    const receipt = {
      schemaVersion: 1,
      task: "T146",
      status: "PASS",
      capturedAt: new Date().toISOString(),
      platform: "Android/Capacitor",
      packageName: PACKAGE_NAME,
      serial,
      deviceModel,
      apiLevel: Number(deviceApi),
      apk: {
        path: apkPath,
        sha256: await sha256File(resolvedApk),
      },
      lifecycle: {
        oldPid,
        newPid: attachment.pid,
        newProcess: oldPid !== attachment.pid,
        targetUrl: attachment.targetUrl,
      },
      assertions: {
        primaryAndIntentRetainedExactlyOnce: true,
        derivedProjectionAndStableOutboxRetainedExactlyOnce: true,
        remoteAcknowledgedProjectionRetainedWithoutOutbox: true,
        staleOwnerProjectionAbsent: true,
        exactFixtureCleanup: true,
      },
      evidenceBoundary:
        "Real API-level WebView process death with isolated IndexedDB fixtures; no authenticated Supabase, physical-device, production-user or cross-device claim.",
    };
    await mkdir(dirname(resolvedReceipt), { recursive: true });
    await writeFile(resolvedReceipt, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: "utf8" });
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  } finally {
    if (seeded && !activeClient) {
      try {
        attachment = await startAndAttach(serial);
        activeClient = attachment.client;
        activeForwardPort = attachment.forwardPort;
      } catch {
        // The receipt remains FAIL and the next run begins with exact-key cleanup.
      }
    }
    if (seeded && activeClient) {
      try {
        await activeClient.evaluate(browserCall(cleanupAutomationLifecycleFixture));
      } catch {
        // A failed process may require a later exact-key cleanup rerun.
      }
    }
    activeClient?.close();
    await removeForward(serial, activeForwardPort);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown T146 Android smoke failure";
  process.stderr.write(`[T146 Android process-death] FAIL: ${message}\n`);
  process.exitCode = 1;
});

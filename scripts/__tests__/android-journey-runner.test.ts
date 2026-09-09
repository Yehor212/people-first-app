// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { countLogcatWindowWarnings } from "../android-motion/run-real-user-journey.mjs";

const temporaryDirectories: string[] = [];
const originalArgv = process.argv;
const runnerPath = path.resolve("scripts/android-motion/run-real-user-journey.mjs");
const selectTexts = [
  "Log how you're feeling", "In this moment", "At a specific time",
  "For the whole day", "Very Unpleasant", "Very Pleasant", "Next",
  "Open menu", "How you feel",
];

function hierarchy(texts: string[]) {
  return `<hierarchy>${texts.map((text, index) =>
    `<node text="${text}" class="android.widget.Button" clickable="true" enabled="true" visible-to-user="true" bounds="[44,${100 + index * 60}][600,${150 + index * 60}]"/>`,
  ).join("")}</hierarchy>`;
}

afterEach(async () => {
  process.argv = originalArgv;
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.doUnmock("node:child_process");
  vi.resetModules();
  await Promise.all(temporaryDirectories.splice(0).map(directory =>
    rm(directory, { recursive: true, force: true }),
  ));
});

async function runIsolatedJourney({
  texts = selectTexts,
  screenshots = false,
  failAtInput = 2,
  inputFailure = new Error("Isolated input transport disconnected"),
  existingEvidence,
  existingScreens = false,
  scenario = "orb-slider-refine",
  completeDrawerCycle = false,
  clockFailureAt = 0,
}: {
  texts?: string[]; screenshots?: boolean; failAtInput?: number;
  inputFailure?: unknown; existingEvidence?: string; scenario?: string;
  completeDrawerCycle?: boolean; clockFailureAt?: number; existingScreens?: boolean;
} = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), "zenflow-journey-test-"));
  temporaryDirectories.push(directory);
  const output = path.join(directory, "journey.json");
  if (existingEvidence !== undefined) await writeFile(output, existingEvidence);
  const existingScreenshot = path.join(directory, "journey-screens", "00-day-orb-select.png");
  if (existingScreens) {
    await mkdir(path.dirname(existingScreenshot));
    await writeFile(existingScreenshot, "preserved original screenshot bytes");
  }
  const commands: string[][] = [];
  let inputs = 0;
  let clockReads = 0;
  let logReads = 0;
  let drawerOpen = false;
  const drawerTexts = ["Menu", "Mood", "Habits", "Diary", "Planning", "Dark", "Settings", "Close menu"];
  const currentTexts = () => completeDrawerCycle && drawerOpen ? [...texts, ...drawerTexts] : texts;
  const transport = async (file: string, args: string[]) => {
    if (file !== "adb" || args[0] !== "-s" || args[1] !== "emulator-5560") {
      throw new Error("Unexpected isolated transport target");
    }
    const command = args.slice(2);
    commands.push(command);
    if (command.join(" ") === "shell cat /proc/uptime") {
      clockReads += 1;
      if (clockReads === clockFailureAt) throw new Error("Isolated clock read failed");
      return { stdout: "1000.00 990.00\n", stderr: "" };
    }
    if (command[0] === "logcat") {
      logReads += 1;
      return { stdout: "09-05 12:00:00.000 1 1 W HWUI: Tile memory limits exceeded\n" +
        (logReads > 1 ? "09-05 12:00:01.000 1 1 W HWUI: Tile memory limits exceeded\n" : ""), stderr: "" };
    }
    if (command[0] === "shell" && command[1] === "input") {
      inputs += 1;
      if (inputs === failAtInput) throw inputFailure;
      if (completeDrawerCycle && command[2] === "tap") {
        const index = (Number(command[4]) - 125) / 60;
        const label = currentTexts()[index];
        if (label === "Open menu") drawerOpen = true;
        if (label === "Mood" || label === "Close menu") drawerOpen = false;
      }
      return { stdout: "", stderr: "" };
    }
    if (command[0] === "exec-out" && command[1] === "cat" && command[2]?.endsWith(".xml")) {
      return { stdout: hierarchy(currentTexts()), stderr: "" };
    }
    if (command[0] === "shell" && command[1] === "screencap") return { stdout: "", stderr: "" };
    if (command[0] === "pull" && command[1]?.endsWith(".png")) {
      await writeFile(command[2], "isolated screenshot transport bytes; not runtime image evidence");
      return { stdout: "", stderr: "" };
    }
    if (command[0] === "shell" && (
      (command[1] === "uiautomator" && command[2] === "dump") ||
      (command[1] === "rm" && command[2] === "-f" && command[3]?.endsWith(".xml"))
    )) return { stdout: "", stderr: "" };
    throw new Error(`Unexpected isolated ADB request: ${command.join(" ")}`);
  };
  const execFile = Object.assign(
    () => { throw new Error("Only the async isolated transport is supported"); },
    { [promisify.custom]: transport },
  );
  vi.doMock("node:child_process", () => ({ execFile }));
  vi.resetModules();
  vi.useFakeTimers();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.stubGlobal("fetch", async () => Response.json([{
    type: "page", webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/page/isolated-test",
  }]));
  vi.stubGlobal("WebSocket", class extends EventTarget {
    constructor() {
      super();
      queueMicrotask(() => this.dispatchEvent(new Event("open")));
    }
    send(data: string) {
      const message = JSON.parse(data);
      if (!["Runtime.enable", "Runtime.evaluate"].includes(message.method)) {
        throw new Error(`Unexpected isolated CDP method: ${message.method}`);
      }
      const result = message.method === "Runtime.enable" ? {} : { result: { value: {
        rendererState: "ready", largeEffectsCanvasCount: 1,
        canvas: { width: 1080, height: 2400, motionModel: "large:4;photons:78;motes:35;threads:18" },
        largeEffectDisplays: {
          "day-cosmic-light-curtain": "none", "day-cosmic-sun-threads": "none",
          "day-cosmic-sun-shower": "none", "day-cosmic-prism-ribbon": "none",
          "day-cosmic-caustics": "none", "day-cosmic-photon-field": "none",
          "day-cosmic-motes": "none",
        },
      } } };
      queueMicrotask(() => this.dispatchEvent(new MessageEvent("message", {
        origin: "ws://127.0.0.1:9222", data: JSON.stringify({ id: message.id, result }),
      })));
    }
    close() {}
  });
  process.argv = [process.execPath, runnerPath, "--serial", "emulator-5560",
    "--output", output, "--scenario", scenario,
    ...(screenshots ? [] : ["--video-only"])];
  let settled = false;
  let rejected = false;
  let failure: unknown;
  const execution = import("../android-motion/run-real-user-journey.mjs").then(
    () => { settled = true; },
    error => { failure = error; rejected = true; settled = true; },
  );
  await vi.waitFor(async () => {
    await vi.advanceTimersByTimeAsync(1000);
    expect(settled).toBe(true);
  }, { interval: 10, timeout: 3000 });
  await execution;
  const payload = await readFile(output, "utf8").then(
    text => JSON.parse(text),
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw error;
    },
  );
  return { commands, failure, payload, rejected,
    existingScreenshot: existingScreens ? await readFile(existingScreenshot, "utf8") : null };
}

describe("Android journey runner failure evidence", () => {
  it("rejects an open drawer even when underlying selection nodes are exposed", async () => {
    const result = await runIsolatedJourney({ texts: [...selectTexts, "Close menu"], failAtInput: 1 });
    expect(result.failure).toBeInstanceOf(Error);
    expect((result.failure as Error).message).toMatch(/initial.*drawer|drawer.*initial/i);
    expect(result.commands.filter(command => command[0] === "shell" && command[1] === "input")).toEqual([]);
  });

  it("preserves observed actions and the original failure when a later input fails", async () => {
    const result = await runIsolatedJourney();
    expect((result.failure as Error).message).toBe("Isolated input transport disconnected");
    expect(result.payload).toMatchObject({
      status: "FAIL",
      failure: { message: "Isolated input transport disconnected" },
      actions: [{ action: "tap", label: "mood set to negative" }],
    });
    expect(result.payload.actions).toHaveLength(1);
    expect(result.payload.pendingAction).toMatchObject({
      action: "swipe", label: "mood negative to neutral", status: "UNVERIFIED",
    });
    expect(result.payload.pendingAction).not.toHaveProperty("result");
    expect(result.payload.checkpoints.map((entry: { label: string }) => entry.label))
      .toContain("01a-day-orb-slider-negative");
  });

  it("preserves shared logcat when screenshot admission fails", async () => {
    const result = await runIsolatedJourney({ texts: [], screenshots: true });
    expect((result.failure as Error).message).toMatch(/missing visible nodes/);
    expect(result.commands.filter(command => command[0] === "logcat" && command.includes("-c"))).toEqual([]);
  });

  it("preserves existing evidence before issuing any device command", async () => {
    const result = await runIsolatedJourney({ existingEvidence: '{"preserved":"original isolated receipt"}\n' });
    expect(result.commands).toEqual([]);
    expect(result.payload).toEqual({ preserved: "original isolated receipt" });
    expect(result.rejected).toBe(true);
  });

  it("does not turn an empty rejection into semantic success", async () => {
    const result = await runIsolatedJourney({ inputFailure: "" });
    expect(result.payload.status).toBe("FAIL");
    expect(result.rejected).toBe(true);
    expect(result.failure).toBe("");
  });

  it("preserves an earlier screenshot directory before issuing device commands", async () => {
    const result = await runIsolatedJourney({ screenshots: true, existingScreens: true,
      failAtInput: 0, scenario: "drawer-theme", completeDrawerCycle: true });
    expect(result.commands).toEqual([]);
    expect(result.existingScreenshot).toBe("preserved original screenshot bytes");
    expect(result.payload.status).toBe("FAIL");
    expect(result.rejected).toBe(true);
  });

  it("retains an initial clock failure with no invented actions or timings", async () => {
    const result = await runIsolatedJourney({ clockFailureAt: 1 });
    expect(result.payload).toMatchObject({ status: "FAIL", actions: [], checkpoints: [],
      clockSync: { started: null, ended: null }, failure: { message: "Isolated clock read failed" } });
    expect(result.rejected).toBe(true);
  });

  it("completes screenshot diagnostics without clearing either observation window", async () => {
    const result = await runIsolatedJourney({ screenshots: true, failAtInput: 0,
      scenario: "drawer-theme", completeDrawerCycle: true });
    expect(result.failure).toBeUndefined();
    expect(result.payload).toMatchObject({ status: "PASS", failure: null,
      tileWarnings: 1, steadyTileWarnings: 0,
      logcatObservation: { separatePackageDiagnosticsRequired: true } });
    expect(result.payload.actions).toHaveLength(8);
    expect(result.commands.filter(command => command[0] === "logcat" && command.includes("-c"))).toEqual([]);
  });

  it("keeps a final clock failure separate from the completed semantic observations", async () => {
    const result = await runIsolatedJourney({ failAtInput: 0, scenario: "drawer-theme",
      completeDrawerCycle: true, clockFailureAt: 2 });
    expect(result.payload).toMatchObject({ status: "FAIL", clockSync: { ended: null },
      failure: { message: "Isolated clock read failed" } });
    expect(result.payload.actions).toHaveLength(8);
    expect(result.rejected).toBe(true);
  });

  it.each([
    ["old warning\n", "old warning\nnew normal entry\n", 0],
    ["old Tile memory limits exceeded\n", "old Tile memory limits exceeded\nnew Tile memory limits exceeded\n", 1],
    ["--------- beginning of main\nanchor\n", "--------- beginning of main\nanchor\n--------- beginning of system\nTile memory limits exceeded\n", 1],
    ["old prefix\nanchor\n", "anchor\nnew normal entry\n", null],
    ["old prefix\n", "replaced prefix\n", null],
    ["", "new normal entry\n", null],
  ])("classifies retained log-window evidence %#", (before, after, expected) => {
    expect(countLogcatWindowWarnings(before, after)).toBe(expected);
  });
});

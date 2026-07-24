import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  dispatchNativeReminderReconcile,
  requestReminderSettingsNavigation,
} from "../notificationLifecycle";

describe("native reminder lifecycle ownership", () => {
  it("emits one reminder wake from the existing deduplicated app-resume owner before unrelated awaits", () => {
    const source = readFileSync(resolve(process.cwd(), "src/main.tsx"), "utf8");
    const resumeStart = source.indexOf("async function handleAppResume");
    const wake = source.indexOf('dispatchNativeReminderReconcile("app-resume")', resumeStart);
    const firstYield = source.indexOf("await yieldToNextTask()", resumeStart);

    expect(wake).toBeGreaterThan(resumeStart);
    expect(wake).toBeLessThan(firstYield);
    expect(source.match(/CapacitorApp\.addListener\("resume"/g)).toHaveLength(1);
  });

  it("publishes a typed native reminder wake synchronously", () => {
    const listener = vi.fn();
    window.addEventListener("zenflow:native-reminder-reconcile", listener);

    try {
      dispatchNativeReminderReconcile("app-resume");
      expect(listener).toHaveBeenCalledTimes(1);
      expect((listener.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
        reason: "app-resume",
      });
    } finally {
      window.removeEventListener("zenflow:native-reminder-reconcile", listener);
    }
  });

  it("carries the incident reason into reminder-settings navigation", () => {
    const listener = vi.fn();
    window.addEventListener("zenflow:open-reminder-settings", listener);

    try {
      requestReminderSettingsNavigation("schedule-uncertain");
      expect(listener).toHaveBeenCalledTimes(1);
      expect((listener.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
        reason: "schedule-uncertain",
      });
    } finally {
      window.removeEventListener("zenflow:open-reminder-settings", listener);
    }
  });
});

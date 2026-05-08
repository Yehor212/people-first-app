import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const HOME_TAB_PATH = path.join(process.cwd(), "src", "components", "tabs", "HomeTab.tsx");

function readHomeTab(): string {
  return fs.readFileSync(HOME_TAB_PATH, "utf-8");
}

describe("HomeTab V1 user surface", () => {
  it("does not render the daily ritual card on the V1 home dashboard", () => {
    const source = readHomeTab();

    expect(source).not.toContain("DailyRitualCard");
    expect(source).not.toContain("reflectionSaveRitual");
  });
});

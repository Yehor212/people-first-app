import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  TASK9_EXPECTED_CAPTURE_IDS,
  validateTask9CaptureSet,
  validateTask9ProductionContext,
} from "../ui-audit/task9-runtime-evidence.mjs";

const temporaryRoots: string[] = [];

function sha256File(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function createCompleteCaptureSet() {
  const repositoryRoot = mkdtempSync(join(tmpdir(), "zenflow-task9-evidence-"));
  temporaryRoots.push(repositoryRoot);
  const outputRoot = "output/task9";
  mkdirSync(join(repositoryRoot, outputRoot), { recursive: true });

  const captures = TASK9_EXPECTED_CAPTURE_IDS.map((id: string, index: number) => {
    const relativePath = `${outputRoot}/${id}.png`;
    const absolutePath = join(repositoryRoot, relativePath);
    writeFileSync(absolutePath, Buffer.from(`task9-capture-${index}`));
    return {
      id,
      path: relativePath,
      sha256: sha256File(absolutePath),
      sizeBytes: readFileSync(absolutePath).byteLength,
      observations:
        id === "AFTER-09-05-settings-high-contrast-font-150" ||
        id === "AFTER-09-03-settings-appearance-ar-paper-medium"
          ? {
              focusVisible: true,
              focusIndicatorVisible: true,
              focusedControlInsidePanel: true,
              headerIconInlineWithCopy: true,
            }
          : {},
      fixtureProvenance: {
        kind: "ISOLATED_TEST_FIXTURE",
        source: "e2e/helpers/zenflowV2State.ts",
        productionReachable: false,
      },
    };
  });

  return { captures, outputRoot, repositoryRoot };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("Task 9 runtime evidence validator", () => {
  it("accepts only the exact complete capture set with matching files and hashes", () => {
    const fixture = createCompleteCaptureSet();

    expect(validateTask9CaptureSet(fixture)).toEqual([]);
  });

  it("rejects missing captures, duplicate IDs, and a tampered file", () => {
    const fixture = createCompleteCaptureSet();
    const firstCapture = fixture.captures[0];
    const tamperedPath = join(fixture.repositoryRoot, firstCapture.path);
    writeFileSync(tamperedPath, Buffer.from("tampered"));
    fixture.captures.splice(1, 1, { ...firstCapture });

    const errors = validateTask9CaptureSet(fixture);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("duplicate capture ID"),
        expect.stringContaining("missing expected capture"),
        expect.stringContaining("size does not match"),
        expect.stringContaining("sha256 does not match"),
      ])
    );
  });

  it("rejects dev, public, or ambiguously configured preview contexts", () => {
    const expectedBaseURL = "http://127.0.0.1:4194/people-first-app/";
    const valid = {
      env: {
        CI: "true",
        ZENFLOW_PLAYWRIGHT_USE_LOCAL_SERVER: "true",
        ZENFLOW_PLAYWRIGHT_PREVIEW_DIR: "dist",
        ZENFLOW_PLAYWRIGHT_LOCAL_PORT: "4194",
      },
      baseURL: expectedBaseURL,
      configuredBaseURL: expectedBaseURL,
    };

    expect(validateTask9ProductionContext(valid)).toEqual([]);
    expect(
      validateTask9ProductionContext({
        ...valid,
        env: { ...valid.env, CI: "", ZENFLOW_PLAYWRIGHT_PREVIEW_DIR: "" },
        baseURL: "https://yehor212.github.io/people-first-app/",
      })
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("CI must be explicitly true"),
        expect.stringContaining("preview directory must be exactly dist"),
        expect.stringContaining("baseURL must match the isolated local preview"),
      ])
    );
  });

  it("rejects high-contrast or RTL captures without real focus-visible evidence", () => {
    const fixture = createCompleteCaptureSet();
    const highContrast = fixture.captures.find(
      ({ id }) => id === "AFTER-09-05-settings-high-contrast-font-150"
    );
    const rtl = fixture.captures.find(
      ({ id }) => id === "AFTER-09-03-settings-appearance-ar-paper-medium"
    );
    if (!highContrast || !rtl) throw new Error("Task 9 focus fixtures are incomplete");

    highContrast.observations = {};
    rtl.observations = {
      focusVisible: true,
      focusIndicatorVisible: false,
      focusedControlInsidePanel: true,
      headerIconInlineWithCopy: false,
    };

    expect(validateTask9CaptureSet(fixture)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "AFTER-09-05-settings-high-contrast-font-150: focus-visible evidence is incomplete"
        ),
        expect.stringContaining(
          "AFTER-09-03-settings-appearance-ar-paper-medium: focus-visible evidence is incomplete"
        ),
        expect.stringContaining(
          "AFTER-09-03-settings-appearance-ar-paper-medium: panel header inline alignment evidence is incomplete"
        ),
      ])
    );
  });
});

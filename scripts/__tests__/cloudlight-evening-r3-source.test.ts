import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const rootDir = process.cwd();

type JsonValue = JsonObject | JsonValue[] | string | number | boolean | null;
type JsonObject = { [key: string]: JsonValue };

function stringLeaves(value: JsonValue, path = ""): Array<{ path: string; value: string }> {
  if (typeof value === "string") {
    return [{ path, value }];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => stringLeaves(item, `${path}[${index}]`));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      stringLeaves(item, path ? `${path}.${key}` : key)
    );
  }

  return [];
}

describe("Cloudlight Evening R3 source contract", () => {
  it("keeps one deterministic composition and three constrained review mixes", () => {
    const source = JSON.parse(
      readFileSync(join(rootDir, "config/audio/cloudlight-evening-r3-source.json"), "utf8")
    ) as JsonObject & {
      candidates: Array<{ id: string; mix: Record<string, number> }>;
      harmonicFields: Array<{ padMidi: number[] }>;
      pianoClusters: Array<{
        start: number;
        notes: Array<{ offset: number; duration: number }>;
      }>;
      rights: { referenceResearch: { title: string } };
    };

    expect(source).toMatchObject({
      schemaVersion: 1,
      id: "cloudlight-evening-r3",
      tempoBpm: 56,
      ppq: 960,
      reviewDurationSeconds: 166,
      runtimeLoopDurationSeconds: 150,
      sourceAudioInputs: [],
      appleLoopsUsed: false,
    });
    expect(source.candidates.map((row) => row.id)).toEqual([
      "candidate-01",
      "candidate-02",
      "candidate-03",
    ]);
    expect(source.pianoClusters.flatMap((cluster) => cluster.notes)).toHaveLength(7);

    const pianoNoteEnds = source.pianoClusters.flatMap((cluster) =>
      cluster.notes.map((note) => cluster.start + note.offset + note.duration)
    );
    expect(Math.max(...pianoNoteEnds)).toBeLessThanOrEqual(138);
    expect(source.harmonicFields.at(-1)?.padMidi).toEqual(source.harmonicFields[0].padMidi);

    const [candidate01, candidate02, candidate03] = source.candidates;
    expect({ ...candidate02, id: candidate01.id }).toEqual({
      ...candidate01,
      mix: {
        ...candidate01.mix,
        shimmerDb: candidate02.mix.shimmerDb,
        shimmerPanPercent: candidate02.mix.shimmerPanPercent,
      },
    });
    expect({ ...candidate03, id: candidate01.id }).toEqual({
      ...candidate01,
      mix: {
        ...candidate01.mix,
        pianoDb: candidate03.mix.pianoDb,
      },
    });

    const referenceTitle = source.rights.referenceResearch.title;
    expect(
      stringLeaves(source).filter(
        (leaf) => leaf.path !== "rights.referenceResearch.title" && leaf.value.includes(referenceTitle)
      )
    ).toEqual([]);
  });
});

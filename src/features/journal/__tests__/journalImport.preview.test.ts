import { describe, expect, it } from "vitest";

import { inspectJournalBackup } from "../journalImport";

function makeFile(payload: unknown): File {
  const content = typeof payload === "string" ? payload : JSON.stringify(payload);
  const file = new File([content], "journal-backup.json", { type: "application/json" });
  if (!file.text) file.text = () => Promise.resolve(content);
  return file;
}

function entry(id: string) {
  return {
    id,
    date: "2026-07-14",
    title: "Preview entry",
    content: "Private content",
    stickers: [],
    photoIds: id === "entry-1" ? ["photo-1"] : [],
    audioIds: id === "entry-1" ? ["audio-1"] : [],
    tags: [],
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("inspectJournalBackup", () => {
  it("summarizes valid entries and linked media without writing data", async () => {
    const inspection = await inspectJournalBackup(
      makeFile({
        version: 2,
        exportedAt: 1,
        entries: [entry("entry-1"), entry("entry-2")],
        photos: [
          {
            id: "photo-1",
            entryId: "entry-1",
            data: "data:image/jpeg;base64,cGhvdG8=",
            thumbnail: "data:image/jpeg;base64,dGh1bWI=",
            width: 800,
            height: 600,
            createdAt: 1,
          },
        ],
        audio: [
          {
            id: "audio-1",
            entryId: "entry-1",
            data: "data:audio/webm;base64,YXVkaW8=",
            duration: 8,
            mimeType: "audio/webm",
            createdAt: 1,
          },
        ],
      }),
    );

    expect(inspection).toEqual({
      canImport: true,
      entries: 2,
      photos: 1,
      audio: 1,
      deletions: 0,
      deletionHistoryIncluded: false,
      issues: 0,
      errors: [],
    });
  });

  it("recognizes version 3 deletion history before confirmation", async () => {
    const inspection = await inspectJournalBackup(
      makeFile({
        version: 3,
        exportedAt: 1,
        entries: [],
        photos: [],
        audio: [],
        deletedEntryIds: ["deleted-entry", "deleted-entry"],
      }),
    );

    expect(inspection).toMatchObject({
      canImport: true,
      deletions: 1,
      deletionHistoryIncluded: true,
      errors: [],
    });
  });

  it("rejects malformed or unsupported files before confirmation", async () => {
    await expect(inspectJournalBackup(makeFile("not-json"))).resolves.toMatchObject({
      canImport: false,
      errors: ["Invalid JSON file"],
    });
    await expect(
      inspectJournalBackup(
        makeFile({ version: 99, exportedAt: 1, entries: [], photos: [] }),
      ),
    ).resolves.toMatchObject({
      canImport: false,
      errors: ["Unsupported backup version: 99"],
    });
  });

  it("reports malformed and orphaned rows before the user confirms a partial import", async () => {
    const inspection = await inspectJournalBackup(
      makeFile({
        version: 2,
        exportedAt: 1,
        entries: [entry("entry-1"), { id: "broken-entry" }],
        photos: [
          {
            id: "orphan-photo",
            entryId: "missing-entry",
            data: "data:image/jpeg;base64,cGhvdG8=",
            thumbnail: "data:image/jpeg;base64,dGh1bWI=",
            width: 800,
            height: 600,
            createdAt: 1,
          },
        ],
        audio: [{ id: "broken-audio" }],
      }),
    );

    expect(inspection).toMatchObject({
      canImport: true,
      entries: 1,
      photos: 0,
      audio: 0,
      issues: 3,
      errors: [],
    });
  });

  it("rejects impossible civil dates during preview", async () => {
    const inspection = await inspectJournalBackup(
      makeFile({
        version: 2,
        exportedAt: 1,
        entries: [entry("entry-valid-date"), { ...entry("entry-impossible-date"), date: "2026-02-30" }],
        photos: [],
        audio: [],
      }),
    );

    expect(inspection).toMatchObject({
      canImport: true,
      entries: 1,
      issues: 1,
      errors: [],
    });
  });

  it("rejects non-positive journal photo geometry during preview", async () => {
    const inspection = await inspectJournalBackup(
      makeFile({
        version: 2,
        exportedAt: 1,
        entries: [entry("entry-1")],
        photos: [
          {
            id: "photo-1",
            entryId: "entry-1",
            data: "data:image/jpeg;base64,cGhvdG8=",
            thumbnail: "data:image/jpeg;base64,dGh1bWI=",
            width: 0,
            height: -1,
            createdAt: 1,
          },
        ],
        audio: [],
      }),
    );

    expect(inspection).toMatchObject({
      canImport: true,
      entries: 1,
      photos: 0,
      issues: 1,
      errors: [],
    });
  });
});

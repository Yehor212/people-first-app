import { describe, expect, it } from "vitest";
import { decideJournalMediaParentSync } from "../journalMediaParentGuard";

describe("journal media parent authority", () => {
  const local = { mediaIds: ["photo-1"], updatedAt: 20 };

  it("allows media only after the server parent references it", () => {
    expect(
      decideJournalMediaParentSync({
        mediaId: "photo-1",
        localParent: local,
        remoteParent: { mediaIds: ["photo-1"], updatedAt: 20 },
      }),
    ).toBe("allow");
  });

  it("waits when the local parent is newer or not yet present on the server", () => {
    expect(
      decideJournalMediaParentSync({
        mediaId: "photo-1",
        localParent: local,
        remoteParent: null,
      }),
    ).toBe("wait");
    expect(
      decideJournalMediaParentSync({
        mediaId: "photo-1",
        localParent: local,
        remoteParent: { mediaIds: [], updatedAt: 10 },
      }),
    ).toBe("wait");
  });

  it("purges a stale media action when either authoritative parent excludes it", () => {
    expect(
      decideJournalMediaParentSync({
        mediaId: "photo-1",
        localParent: { mediaIds: [], updatedAt: 20 },
        remoteParent: { mediaIds: ["photo-1"], updatedAt: 10 },
      }),
    ).toBe("purge");
    expect(
      decideJournalMediaParentSync({
        mediaId: "photo-1",
        localParent: local,
        remoteParent: { mediaIds: [], updatedAt: 20 },
      }),
    ).toBe("purge");
  });
});

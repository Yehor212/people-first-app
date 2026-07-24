import { supabase } from "@/lib/supabaseClient";
import { db } from "@/storage/db";
import { validateSyncOwner } from "./syncOwner";

export type JournalMediaParentDecision = "allow" | "wait" | "purge";

interface JournalMediaParentState {
  mediaIds: readonly string[];
  updatedAt: number;
}

interface JournalMediaParentDecisionInput {
  mediaId: string;
  localParent: JournalMediaParentState | null;
  remoteParent: JournalMediaParentState | null;
}

function toTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function decideJournalMediaParentSync({
  mediaId,
  localParent,
  remoteParent,
}: JournalMediaParentDecisionInput): JournalMediaParentDecision {
  if (!localParent?.mediaIds.includes(mediaId)) return "purge";
  if (!remoteParent) return "wait";
  if (remoteParent.mediaIds.includes(mediaId)) return "allow";
  return remoteParent.updatedAt >= localParent.updatedAt ? "purge" : "wait";
}

async function getJournalMediaParentSyncDecision(
  kind: "photo" | "audio",
  mediaId: string,
  entryId: string,
  expectedOwnerUserId: string,
): Promise<JournalMediaParentDecision> {
  const userId = await validateSyncOwner(expectedOwnerUserId, "Journal media parent check");
  const localEntry = await db.journalEntries.get(entryId);
  const localParent: JournalMediaParentState | null = localEntry
    ? {
        mediaIds: kind === "photo" ? localEntry.photoIds : localEntry.audioIds ?? [],
        updatedAt: localEntry.updatedAt,
      }
    : null;

  if (!localParent?.mediaIds.includes(mediaId)) return "purge";
  if (!supabase || !userId) return "wait";

  const { data, error } = await supabase
    .from("journal_entries")
    .select(kind === "photo" ? "photo_ids,updated_at" : "audio_ids,updated_at")
    .eq("id", entryId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  await validateSyncOwner(expectedOwnerUserId, "Journal media parent response");

  const row = data as
    | { photo_ids?: string[] | null; audio_ids?: string[] | null; updated_at?: unknown }
    | null;
  const remoteParent: JournalMediaParentState | null = row
    ? {
        mediaIds: kind === "photo" ? row.photo_ids ?? [] : row.audio_ids ?? [],
        updatedAt: toTimestamp(row.updated_at),
      }
    : null;

  return decideJournalMediaParentSync({ mediaId, localParent, remoteParent });
}

export function getJournalPhotoParentSyncDecision(
  photoId: string,
  entryId: string,
  expectedOwnerUserId: string,
): Promise<JournalMediaParentDecision> {
  return getJournalMediaParentSyncDecision(
    "photo",
    photoId,
    entryId,
    expectedOwnerUserId,
  );
}

export function getJournalAudioParentSyncDecision(
  audioId: string,
  entryId: string,
  expectedOwnerUserId: string,
): Promise<JournalMediaParentDecision> {
  return getJournalMediaParentSyncDecision(
    "audio",
    audioId,
    entryId,
    expectedOwnerUserId,
  );
}

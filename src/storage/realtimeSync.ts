/**
 * Real-time Sync Service
 * Provides granular sync for individual data items (moods, habits, etc.)
 * Uses offline queue when device is offline for reliable sync.
 * Falls back to full backup sync if granular sync fails.
 *
 * Per-entity sync functions are in ./sync/ modules.
 * This file keeps: pullFromCloud, pushToCloud, realtime subscriptions.
 */

import { logger } from "@/lib/logger";
import type { SeverityLevel } from "@sentry/core";
import type { ErrorCategory } from "@/lib/sentry";
import { calculateHabitEndDate } from "@/lib/habitPlan";
import { SK } from "@/lib/storageKeys";

// Lazy-load sentry to keep @sentry/* (~250 KB) off the critical rendering path.
// Breadcrumbs are fire-and-forget telemetry — async import is safe.
const lazyCategorizedBreadcrumb = (
  category: ErrorCategory,
  message: string,
  data?: Record<string, unknown>,
  level?: SeverityLevel
) => {
  import("@/lib/sentry")
    .then((mod) => mod.addCategorizedBreadcrumb(category, message, data, level))
    .catch((e) => logger.warn("[Sentry] lazy load skipped:", e));
};
import { isAbortError, isValidUUID } from "@/lib/validation";
import { supabase, getCurrentUserId } from "@/lib/supabaseClient";
import { db } from "@/storage/db";
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from "@/types";
import type { JournalEntry, JournalPhoto, JournalAudio } from "@/features/journal/types";
import { normalizeJournalPhotoLayout } from "@/features/journal/photoLayout";
import { normalizeJournalStyleFieldsFromCloud } from "@/features/journal/journalStyleFields";
import { getJournalContentVaultKey } from "@/features/journal/journalContentSession";
import { isEncryptedJournalContent } from "@/features/journal/journalCrypto";
import {
  canApplyJournalEntryForVaultEpoch,
  canApplyJournalMediaForVaultEpoch,
  readDurableJournalVaultEpochForIngress,
} from "@/features/journal/journalVaultEpoch";
import { runWithJournalSecurityWriteLock } from "@/features/journal/journalSecurityWriteLock";
import { runWithOriginExclusiveLock } from "@/lib/originExclusiveLock";
import {
  ACCOUNT_BOUNDARY_DATA_WRITE_LOCK,
  assertAccountSessionTransitionGeneration,
  assertOriginAccountBoundaryGeneration,
  captureAccountSessionTransitionGeneration,
  captureOriginAccountBoundaryGeneration,
  isAccountBoundaryChangedError,
} from "@/storage/accountBoundaryRuntime";
import { RealtimeChannel } from "@supabase/supabase-js";
import {
  fetchAndMergeServerTombstones,
  mergeSyncTombstones,
} from "@/storage/sync/serverTombstones";
import {
  runtimeMoodEntrySchema,
  runtimeHabitSchema,
  runtimeFocusSessionSchema,
  runtimeGratitudeEntrySchema,
  validateArray,
} from "@/lib/schemas";
import { decodeHabitCompletionFromCloud } from "./sync/habitCompletionCodec";
import { isAccountSyncedSettingKey } from "./sync/settingSyncPolicy";
import { applyIncomingAccountSetting } from "./sync/journalVaultSyncPolicy";
import { SyncOwnerBoundaryError, validateSyncOwner } from "./sync/syncOwner";

// Re-export all per-entity sync functions so existing imports continue to work
export {
  // Shared utilities
  detectNetworkError,
  processBatched,
  BATCH_SIZE,
  BATCH_DELAY,
  // Mood
  syncMood,
  deleteMoodFromCloud,
  pullMoodsFromCloud,
  // Habit
  syncHabit,
  deleteHabitFromCloud,
  syncHabitCompletion,
  // Focus
  syncFocusSession,
  pullFocusFromCloud,
  // Gratitude
  syncGratitude,
  deleteGratitudeFromCloud,
  pullGratitudeFromCloud,
  // Settings
  syncSetting,
  deleteSettingFromCloud,
  deleteRemoteJournalVault,
  // Journal
  syncJournalEntry,
  deleteJournalEntryFromCloud,
  syncJournalPhoto,
  syncJournalAudio,
  deleteJournalPhotoFromCloud,
  deleteJournalAudioFromCloud,
  // User stats
  fetchUserStats,
} from "./sync";

export type {
  RemoteVaultDeleteInput,
  RequiredRemoteCommitFailureOutcome,
  RequiredRemoteCommitOptions,
  RequiredRemoteCommitResult,
} from "./sync";

// Import functions used by pushToCloud
import {
  processBatched,
  syncMood,
  syncHabit,
  syncFocusSession,
  syncGratitude,
  syncSetting,
  deleteSettingFromCloud,
  syncJournalEntry,
  syncJournalPhoto,
  syncJournalAudio,
} from "./sync";

// Track active subscriptions
let realtimeChannel: RealtimeChannel | null = null;

function isEncryptedJournalMediaStoragePath(path: string | null | undefined): boolean {
  return Boolean(path?.toLowerCase().endsWith(".bin"));
}

function canPullJournalEntryWhileLocked(entry: { content?: string | null }): boolean {
  return !entry.content || isEncryptedJournalContent(entry.content);
}

function canPullJournalMediaWhileLocked(media: { storage_path?: string | null }): boolean {
  return !media.storage_path || isEncryptedJournalMediaStoragePath(media.storage_path);
}

// ============================================
// FULL PULL FROM CLOUD
// ============================================

export const pullFromCloud = async (expectedOwnerUserId?: string): Promise<boolean> => {
  if (!supabase) return false;

  const accountBoundaryGeneration = captureOriginAccountBoundaryGeneration();
  const sessionGeneration = captureAccountSessionTransitionGeneration();
  const assertBoundaryGenerations = () => {
    assertOriginAccountBoundaryGeneration(accountBoundaryGeneration);
    assertAccountSessionTransitionGeneration(sessionGeneration);
  };

  try {
    assertBoundaryGenerations();
    const userId = await validateSyncOwner(expectedOwnerUserId, "Cloud snapshot pull");
    assertBoundaryGenerations();
    if (!userId) {
      logger.warn("[Sync] Cannot pull from cloud: User not authenticated");
      return false;
    }
    const assertSnapshotOwnerCurrent = async () => {
      assertBoundaryGenerations();
      const currentOwnerUserId = await validateSyncOwner(userId, "Cloud snapshot pull");
      assertBoundaryGenerations();
      if (currentOwnerUserId !== userId) {
        throw new SyncOwnerBoundaryError("Cloud snapshot pull");
      }
    };

    lazyCategorizedBreadcrumb("sync", "Starting pullFromCloud");

    // Fetch all data in parallel
    const [
      moodsRes,
      habitsRes,
      completionsRes,
      remindersRes,
      focusRes,
      gratitudeRes,
      settingsRes,
      journalEntriesRes,
      journalPhotosRes,
      journalAudioRes,
      tombstonesRes,
    ] = await Promise.all([
      supabase
        .from("moods")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(1000),
      supabase.from("habits").select("*").eq("user_id", userId).limit(500),
      supabase
        .from("habit_completions")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(2000),
      supabase.from("habit_reminders").select("*").eq("user_id", userId).limit(500),
      supabase
        .from("focus_sessions")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(1000),
      supabase
        .from("gratitude_entries")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(1000),
      supabase.from("user_settings").select("*").eq("user_id", userId),
      supabase
        .from("journal_entries")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(1000),
      supabase.from("journal_photos").select("*").eq("user_id", userId).limit(5000),
      supabase.from("journal_audio").select("*").eq("user_id", userId).limit(3000),
      supabase
        .from("sync_tombstones")
        .select("entity_type, entity_id, deleted_seq")
        .eq("user_id", userId)
        .order("deleted_seq", { ascending: true })
        .limit(100000),
    ]);

    // The response belongs to the account captured before the parallel fetch.
    // Discard it before any local tombstone or data mutation if auth changed.
    await assertSnapshotOwnerCurrent();

    // Check for errors
    if (moodsRes.error) throw moodsRes.error;
    if (habitsRes.error) throw habitsRes.error;
    if (completionsRes.error) throw completionsRes.error;
    if (remindersRes.error) throw remindersRes.error;
    if (focusRes.error) throw focusRes.error;
    if (gratitudeRes.error) throw gratitudeRes.error;
    if (settingsRes.error) throw settingsRes.error;
    if (journalEntriesRes.error) throw journalEntriesRes.error;
    if (journalPhotosRes.error) throw journalPhotosRes.error;
    if (journalAudioRes.error) throw journalAudioRes.error;
    if (tombstonesRes.error) throw tombstonesRes.error;

    // Supabase data — types flow from Database interface via .from()
    const moodsData = moodsRes.data || [];
    const habitsData = habitsRes.data || [];
    const completionsData = completionsRes.data || [];
    const remindersData = remindersRes.data || [];
    const focusData = focusRes.data || [];
    const gratitudeData = gratitudeRes.data || [];
    const settingsData = settingsRes.data || [];
    const hasLegacyCloudPrivacy = settingsData.some((setting) => setting.key === SK.PRIVACY);
    const journalEntriesData = journalEntriesRes.data || [];
    const journalPhotosData = journalPhotosRes.data || [];
    const journalAudioData = journalAudioRes.data || [];
    const deletedIds = await runWithOriginExclusiveLock(
      ACCOUNT_BOUNDARY_DATA_WRITE_LOCK,
      async () => {
        await assertSnapshotOwnerCurrent();
        const merged = await mergeSyncTombstones(
          tombstonesRes.data || [],
          userId,
          assertSnapshotOwnerCurrent
        );
        await assertSnapshotOwnerCurrent();
        return merged;
      }
    );
    const lockedProtectedJournal =
      Boolean(await db.settings.get(SK.JOURNAL_PASSWORD)) && !getJournalContentVaultKey();
    const pullableJournalEntriesData = lockedProtectedJournal
      ? journalEntriesData.filter(canPullJournalEntryWhileLocked)
      : journalEntriesData;
    const pullableJournalEntryIds = new Set(pullableJournalEntriesData.map((entry) => entry.id));
    const shouldFilterJournalMediaByPulledEntries =
      lockedProtectedJournal && journalEntriesData.length > 0;
    const pullableJournalPhotosData = lockedProtectedJournal
      ? journalPhotosData.filter(
          (photo) =>
            canPullJournalMediaWhileLocked(photo) &&
            (!shouldFilterJournalMediaByPulledEntries ||
              pullableJournalEntryIds.has(photo.entry_id))
        )
      : journalPhotosData;
    const pullableJournalAudioData = lockedProtectedJournal
      ? journalAudioData.filter(
          (audio) =>
            canPullJournalMediaWhileLocked(audio) &&
            (!shouldFilterJournalMediaByPulledEntries ||
              pullableJournalEntryIds.has(audio.entry_id))
        )
      : journalAudioData;

    // Transform cloud data to local format
    const moods: MoodEntry[] = validateArray(
      runtimeMoodEntrySchema,
      moodsData.map((m) => ({
        id: m.id,
        mood: m.mood,
        note: m.note || undefined,
        date: m.date,
        timestamp: m.timestamp,
        tags: m.tags,
        emotion: m.emotion || undefined,
        // State of Mind fields (v2.0.0)
        valence: m.valence ?? undefined,
        logType: m.log_type ?? undefined,
        emotionTags: m.emotion_tags ?? undefined,
        contexts: m.contexts ?? undefined,
      })),
      "cloud-moods"
    ) as MoodEntry[];

    const cloudHabitTypes = new Map<string, "boolean" | "numerical">(
      habitsData.map((h) => [
        h.id,
        h.type === "multiple" || h.type === "reduce" ? "numerical" : "boolean",
      ])
    );

    // Group completions by habit → convert to entries format
    const entriesByHabit = new Map<string, Record<string, { value: number }>>();
    for (const c of completionsData) {
      let habitEntries = entriesByHabit.get(c.habit_id);
      if (!habitEntries) {
        habitEntries = {};
        entriesByHabit.set(c.habit_id, habitEntries);
      }
      const habitType =
        c.habit_type === "numerical" || c.habit_type === "boolean"
          ? c.habit_type
          : (cloudHabitTypes.get(c.habit_id) ?? "boolean");
      habitEntries[c.date] = {
        value: decodeHabitCompletionFromCloud({
          habitType,
          count: c.count,
          duration: c.duration,
          entryValue: c.entry_value,
        }),
      };
    }

    const remindersByHabit = new Map<
      string,
      Array<{ enabled: boolean; time: string; days: number[] }>
    >();
    for (const r of remindersData) {
      let reminders = remindersByHabit.get(r.habit_id);
      if (!reminders) {
        reminders = [];
        remindersByHabit.set(r.habit_id, reminders);
      }
      reminders.push({
        enabled: r.enabled ?? true,
        time: r.time,
        days: r.days ?? [],
      });
    }

    const habits: Habit[] = validateArray(
      runtimeHabitSchema,
      habitsData.map((h) => {
        const entries = entriesByHabit.get(h.id) || {};
        const reminders = remindersByHabit.get(h.id) || [];
        // Map old cloud type → new habitType
        const cloudType = h.type || "daily";
        const habitType =
          cloudType === "multiple" || cloudType === "reduce" ? "numerical" : "boolean";
        // Map old cloud frequency → new ratio
        const cloudFreq = h.frequency || "daily";
        const frequency =
          cloudFreq === "weekly"
            ? { numerator: 1, denominator: 7 }
            : { numerator: 1, denominator: 1 };
        // Parse color: try number, fallback to string
        const colorRaw = h.color;
        const color =
          typeof colorRaw === "string" && /^\d+$/.test(colorRaw)
            ? parseInt(colorRaw, 10)
            : colorRaw;

        return {
          id: h.id,
          name: h.name,
          icon: h.icon,
          color,
          entries,
          createdAt: h.created_at ? new Date(h.created_at).getTime() : Date.now(),
          templateId: h.template_id || undefined,
          habitType,
          reminders,
          frequency,
          question: "",
          description: "",
          isArchived: Boolean(h.is_archived),
          position: 0,
          targetValue: h.daily_target || h.target_count || 0,
          targetType: cloudType === "reduce" ? "atMost" : "atLeast",
          unit: "",
          durationDays: h.requires_duration ? h.target_duration || undefined : undefined,
          startDate: h.requires_duration ? h.start_date || undefined : undefined,
          endDate:
            h.requires_duration && h.start_date && h.target_duration
              ? calculateHabitEndDate(h.start_date, h.target_duration)
              : undefined,
          updatedAt: h.updated_at || undefined,
        };
      }),
      "cloud-habits"
    ) as Habit[];

    const focusSessions: FocusSession[] = validateArray(
      runtimeFocusSessionSchema,
      focusData.map((f) => ({
        id: f.id,
        duration: f.duration,
        completedAt: f.completed_at,
        date: f.date,
        label: f.label || undefined,
        status: f.status,
        reflection: f.reflection || undefined,
      })),
      "cloud-focusSessions"
    );

    const gratitudeEntries: GratitudeEntry[] = validateArray(
      runtimeGratitudeEntrySchema,
      gratitudeData.map((g) => ({
        id: g.id,
        text: g.text,
        date: g.date,
        timestamp: g.timestamp,
      })),
      "cloud-gratitudeEntries"
    );

    // Transform journal data from cloud to local format
    // Note: photos/audio only have metadata here — binary data lives in Storage
    // and will be lazily downloaded when the user views an entry
    let journalEntries: JournalEntry[] = pullableJournalEntriesData.map((e) => ({
      id: e.id,
      date: e.date,
      title: e.title,
      content: e.content,
      stickers: e.stickers,
      mood: e.mood as JournalEntry["mood"],
      tags: e.tags,
      templateId: e.template_id || undefined,
      habitSnapshot: (e.habit_snapshot as JournalEntry["habitSnapshot"]) || undefined,
      photoIds: e.photo_ids,
      audioIds: e.audio_ids,
      photoLayout: normalizeJournalPhotoLayout(e.photo_layout, e.photo_ids),
      ...normalizeJournalStyleFieldsFromCloud(e),
      createdAt: e.created_at,
      updatedAt: e.updated_at,
      vaultRevision: e.vault_revision ?? undefined,
    }));

    let journalPhotos: JournalPhoto[] = pullableJournalPhotosData.map((p) => ({
      id: p.id,
      entryId: p.entry_id,
      data: "", // Binary data not stored in Supabase table — download from Storage on demand
      thumbnail: "",
      width: p.width,
      height: p.height,
      createdAt: p.created_at,
      storagePath: p.storage_path || undefined,
      vaultRevision: p.vault_revision ?? undefined,
    }));

    let journalAudioItems: JournalAudio[] = pullableJournalAudioData.map((a) => ({
      id: a.id,
      entryId: a.entry_id,
      data: "", // Binary data not stored in Supabase table — download from Storage on demand
      duration: a.duration,
      mimeType: a.mime_type,
      createdAt: a.created_at,
      storagePath: a.storage_path || undefined,
      vaultRevision: a.vault_revision ?? undefined,
    }));

    // P2-4 Fix: Save to local DB with explicit transaction error handling
    // Dexie transactions are atomic - if any operation fails, all changes roll back
    try {
      await runWithOriginExclusiveLock(ACCOUNT_BOUNDARY_DATA_WRITE_LOCK, async () => {
        await assertSnapshotOwnerCurrent();
        await runWithJournalSecurityWriteLock(async () => {
          // The snapshot was fetched outside the lock. Password activation may
          // have completed while the network request was in flight, so both the
          // account owner and diary-protection epoch must be checked again at the
          // local commit boundary.
          await assertSnapshotOwnerCurrent();
          const durableVaultAtCommit = await readDurableJournalVaultEpochForIngress();
          if (durableVaultAtCommit.protected) {
            const snapshotContainedEntries = journalEntries.length > 0;
            journalEntries = journalEntries.filter((entry) =>
              canApplyJournalEntryForVaultEpoch(entry, durableVaultAtCommit)
            );
            const protectedEntryIds = new Set(journalEntries.map((entry) => entry.id));
            journalPhotos = journalPhotos.filter(
              (photo) =>
                canApplyJournalMediaForVaultEpoch(photo, durableVaultAtCommit, userId) &&
                (!snapshotContainedEntries || protectedEntryIds.has(photo.entryId))
            );
            journalAudioItems = journalAudioItems.filter(
              (audio) =>
                canApplyJournalMediaForVaultEpoch(audio, durableVaultAtCommit, userId) &&
                (!snapshotContainedEntries || protectedEntryIds.has(audio.entryId))
            );
          }

          await db.transaction(
            "rw",
            [
              db.moods,
              db.habits,
              db.focusSessions,
              db.gratitudeEntries,
              db.settings,
              db.journalEntries,
              db.journalPhotos,
              db.journalAudio,
            ],
            async () => {
              assertBoundaryGenerations();
              // Upsert all data
              if (deletedIds.mood.size > 0) {
                await db.moods.bulkDelete([...deletedIds.mood]);
              }
              if (moods.length) {
                const filteredMoods =
                  deletedIds.mood.size > 0
                    ? moods.filter((m) => !deletedIds.mood.has(m.id))
                    : moods;
                if (filteredMoods.length) await db.moods.bulkPut(filteredMoods);
              }

              // Filter out tombstoned habits before saving; deletes beat stale snapshots.
              if (deletedIds.habit.size > 0) {
                await db.habits.bulkDelete([...deletedIds.habit]);
              }
              if (habits.length) {
                const filteredHabits =
                  deletedIds.habit.size > 0
                    ? habits.filter((h) => !deletedIds.habit.has(h.id))
                    : habits;
                if (filteredHabits.length) await db.habits.bulkPut(filteredHabits);
              }
              if (deletedIds.focus.size > 0) {
                await db.focusSessions.bulkDelete([...deletedIds.focus]);
              }
              if (focusSessions.length) {
                const filteredFocus =
                  deletedIds.focus.size > 0
                    ? focusSessions.filter((f) => !deletedIds.focus.has(f.id))
                    : focusSessions;
                if (filteredFocus.length) await db.focusSessions.bulkPut(filteredFocus);
              }
              if (deletedIds.gratitude.size > 0) {
                await db.gratitudeEntries.bulkDelete([...deletedIds.gratitude]);
              }
              if (gratitudeEntries.length) {
                const filteredGratitude =
                  deletedIds.gratitude.size > 0
                    ? gratitudeEntries.filter((g) => !deletedIds.gratitude.has(g.id))
                    : gratitudeEntries;
                if (filteredGratitude.length) await db.gratitudeEntries.bulkPut(filteredGratitude);
              }

              // Journal entries: use updatedAt-based conflict resolution + deletion tracking
              if (journalEntries.length) {
                const localEntries = await db.journalEntries.toArray();
                const localMap = new Map(localEntries.map((e) => [e.id, e]));
                const merged = journalEntries
                  .filter((remote) => !deletedIds.journal.has(remote.id))
                  .map((remote) => {
                    const local = localMap.get(remote.id);
                    if (!local) return remote;
                    // Keep whichever has the newer updatedAt
                    return local.updatedAt > remote.updatedAt ? local : remote;
                  });
                if (merged.length) await db.journalEntries.bulkPut(merged);

                // The winning parent entry is authoritative for media membership.
                // Purge local media removed by a newer parent and ignore orphaned
                // remote metadata so an older client cannot resurrect it.
                const authoritativeEntries = new Map(merged.map((entry) => [entry.id, entry]));
                const localPhotos = await db.journalPhotos.toArray();
                const stalePhotoIds = localPhotos
                  .filter((photo) => {
                    const parent = authoritativeEntries.get(photo.entryId);
                    return parent ? !parent.photoIds.includes(photo.id) : false;
                  })
                  .map((photo) => photo.id);
                if (stalePhotoIds.length > 0) await db.journalPhotos.bulkDelete(stalePhotoIds);

                const localAudio = await db.journalAudio.toArray();
                const staleAudioIds = localAudio
                  .filter((audio) => {
                    const parent = authoritativeEntries.get(audio.entryId);
                    return parent ? !(parent.audioIds ?? []).includes(audio.id) : false;
                  })
                  .map((audio) => audio.id);
                if (staleAudioIds.length > 0) await db.journalAudio.bulkDelete(staleAudioIds);

                // Journal photos: merge — filter out deleted entries + preserve local binary data
                if (journalPhotos.length) {
                  const filteredPhotos =
                    deletedIds.journal.size > 0
                      ? journalPhotos.filter((p) => !deletedIds.journal.has(p.entryId))
                      : journalPhotos;
                  const referencedPhotos = filteredPhotos.filter((photo) => {
                    const parent = authoritativeEntries.get(photo.entryId);
                    return parent ? parent.photoIds.includes(photo.id) : false;
                  });
                  if (referencedPhotos.length) {
                    const localPhotoMap = new Map(localPhotos.map((p) => [p.id, p]));
                    const mergedPhotos = referencedPhotos.map((remote) => {
                      const local = localPhotoMap.get(remote.id);
                      if (local && local.data)
                        return {
                          ...remote,
                          data: local.data,
                          thumbnail: local.thumbnail,
                        };
                      return remote;
                    });
                    await db.journalPhotos.bulkPut(mergedPhotos);
                  }
                }

                // Journal audio: same logic as photos
                if (journalAudioItems.length) {
                  const filteredAudio =
                    deletedIds.journal.size > 0
                      ? journalAudioItems.filter((a) => !deletedIds.journal.has(a.entryId))
                      : journalAudioItems;
                  const referencedAudio = filteredAudio.filter((audio) => {
                    const parent = authoritativeEntries.get(audio.entryId);
                    return parent ? (parent.audioIds ?? []).includes(audio.id) : false;
                  });
                  if (referencedAudio.length) {
                    const localAudioMap = new Map(localAudio.map((a) => [a.id, a]));
                    const mergedAudio = referencedAudio.map((remote) => {
                      const local = localAudioMap.get(remote.id);
                      if (local && local.data) return { ...remote, data: local.data };
                      return remote;
                    });
                    await db.journalAudio.bulkPut(mergedAudio);
                  }
                }
              }

              // Settings
              for (const s of settingsData) {
                if (!isAccountSyncedSettingKey(s.key)) continue;
                await applyIncomingAccountSetting(s.key, s.value);
              }
              assertBoundaryGenerations();
            }
          );
          await assertSnapshotOwnerCurrent();
        });
        await assertSnapshotOwnerCurrent();
      });
    } catch (transactionError) {
      if (
        transactionError instanceof SyncOwnerBoundaryError ||
        isAccountBoundaryChangedError(transactionError)
      ) {
        throw transactionError;
      }
      // P2-4 Fix: Emit event for UI awareness when transaction fails
      logger.error("[Sync] Transaction failed during pullFromCloud");
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("zenflow:sync-transaction-failed", {
            detail: {
              operation: "pullFromCloud",
              error: "SYNC_TRANSACTION_FAILED",
              dataAffected: {
                moods: moods.length,
                habits: habits.length,
                focusSessions: focusSessions.length,
                gratitudeEntries: gratitudeEntries.length,
                journalEntries: journalEntries.length,
              },
            },
          })
        );
      }
      throw transactionError; // Re-throw to be caught by outer catch
    }

    // Privacy choices now authorize optional services on this device only.
    // Remove a historical account-scoped row after the local snapshot has
    // safely ignored it; the delete path queues a retry on network failure.
    if (hasLegacyCloudPrivacy) {
      await validateSyncOwner(userId, "Legacy privacy cleanup");
      await deleteSettingFromCloud(SK.PRIVACY, userId);
    }

    lazyCategorizedBreadcrumb("sync", "pullFromCloud completed", {
      moods: moods.length,
      habits: habits.length,
      focusSessions: focusSessions.length,
      gratitudeEntries: gratitudeEntries.length,
      journalEntries: journalEntries.length,
    });
    logger.log("[Sync] Pulled from cloud:", {
      moods: moods.length,
      habits: habits.length,
      focusSessions: focusSessions.length,
      gratitudeEntries: gratitudeEntries.length,
      journalEntries: journalEntries.length,
    });

    return true;
  } catch (error) {
    if (error instanceof SyncOwnerBoundaryError || isAccountBoundaryChangedError(error)) {
      logger.warn("[Sync] pullFromCloud discarded at an account boundary");
      return false;
    }
    // Handle AbortError gracefully
    if (isAbortError(error)) {
      lazyCategorizedBreadcrumb("sync", "pullFromCloud aborted", {}, "warning");
      logger.warn("[Sync] pullFromCloud aborted (timeout or navigation)");
      return false;
    }
    lazyCategorizedBreadcrumb(
      "sync",
      "pullFromCloud failed",
      { failureCode: "SYNC_SNAPSHOT_PULL_FAILED" },
      "error"
    );
    logger.error("[Sync] Failed to pull from cloud");
    logger.warn("[Sync] Operation failed, will retry via orchestrator");
    return false;
  }
};

// ============================================
// FULL PUSH TO CLOUD
// ============================================

export const pushToCloud = async (): Promise<boolean> => {
  const userId = await getCurrentUserId();
  // Explicit validation to prevent RLS violations with undefined user_id
  if (!supabase) return false;
  if (!userId) {
    logger.warn("[Sync] Cannot push to cloud: User not authenticated");
    return false;
  }

  lazyCategorizedBreadcrumb("sync", "Starting pushToCloud");

  try {
    const deletedIds = await fetchAndMergeServerTombstones(100000, userId);
    const [
      moods,
      habits,
      focusSessions,
      gratitudeEntries,
      settings,
      journalEntries,
      journalPhotos,
      journalAudio,
    ] = await Promise.all([
      db.moods.toArray(),
      db.habits.toArray(),
      db.focusSessions.toArray(),
      db.gratitudeEntries.toArray(),
      db.settings.toArray(),
      db.journalEntries.toArray(),
      db.journalPhotos.toArray(),
      db.journalAudio.toArray(),
    ]);

    const liveMoods =
      deletedIds.mood.size > 0 ? moods.filter((m) => !deletedIds.mood.has(m.id)) : moods;
    const liveHabits =
      deletedIds.habit.size > 0 ? habits.filter((h) => !deletedIds.habit.has(h.id)) : habits;
    const liveFocusSessions =
      deletedIds.focus.size > 0
        ? focusSessions.filter((f) => !deletedIds.focus.has(f.id))
        : focusSessions;
    const liveGratitudeEntries =
      deletedIds.gratitude.size > 0
        ? gratitudeEntries.filter((g) => !deletedIds.gratitude.has(g.id))
        : gratitudeEntries;
    const liveJournalEntries =
      deletedIds.journal.size > 0
        ? journalEntries.filter((e) => !deletedIds.journal.has(e.id))
        : journalEntries;
    const liveJournalPhotos =
      deletedIds.journal.size > 0
        ? journalPhotos.filter((p) => !deletedIds.journal.has(p.entryId))
        : journalPhotos;
    const liveJournalAudio =
      deletedIds.journal.size > 0
        ? journalAudio.filter((a) => !deletedIds.journal.has(a.entryId))
        : journalAudio;

    // Sync all data in batches to avoid overwhelming the backend.
    // Server tombstones are merged first so stale local rows cannot create
    // newer upsert events after another device has deleted the entity.
    await processBatched(liveMoods, (m) => syncMood(m));
    await processBatched(liveHabits, (h) => syncHabit(h));
    await processBatched(liveFocusSessions, (f) => syncFocusSession(f));
    await processBatched(liveGratitudeEntries, (g) => syncGratitude(g));
    await processBatched(
      settings.filter((s) => isAccountSyncedSettingKey(s.key)),
      (s) => syncSetting(s.key, s.value, userId)
    );
    await processBatched(liveJournalEntries, (e) => syncJournalEntry(e, userId));
    await processBatched(liveJournalPhotos, (p) => syncJournalPhoto(p, userId));
    await processBatched(liveJournalAudio, (a) => syncJournalAudio(a, userId));

    lazyCategorizedBreadcrumb("sync", "pushToCloud completed", {
      moods: moods.length,
      habits: habits.length,
      focusSessions: focusSessions.length,
      gratitudeEntries: gratitudeEntries.length,
      journalEntries: journalEntries.length,
    });
    logger.log("[Sync] Pushed to cloud:", {
      moods: moods.length,
      habits: habits.length,
      focusSessions: focusSessions.length,
      gratitudeEntries: gratitudeEntries.length,
      journalEntries: journalEntries.length,
    });

    return true;
  } catch (error) {
    // Handle AbortError gracefully
    if (isAbortError(error)) {
      lazyCategorizedBreadcrumb("sync", "pushToCloud aborted", {}, "warning");
      logger.warn("[Sync] pushToCloud aborted (timeout or navigation)");
      return false;
    }
    lazyCategorizedBreadcrumb(
      "sync",
      "pushToCloud failed",
      { error: (error as Error).message },
      "error"
    );
    logger.error("[Sync] Failed to push to cloud:", error);
    logger.warn("[Sync] Operation failed, will retry via orchestrator");
    return false;
  }
};

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================

/**
 * DISABLED: Realtime subscriptions for core tables
 *
 * Performance optimization: WAL query was consuming 96% of database time.
 * Data now syncs via pullFromCloud() on app resume instead of realtime.
 *
 * friend_challenge_members remains realtime-enabled via challengeService.ts
 * for live leaderboard updates.
 */
export const subscribeToRealtime = async (): Promise<void> => {
  // Disabled to reduce WAL overhead - data syncs on app resume via pullFromCloud()
  logger.log("[Realtime] Subscriptions disabled for performance optimization");
  return;
};

export const unsubscribeFromRealtime = async (): Promise<void> => {
  if (!supabase || !realtimeChannel) return;

  await supabase.removeChannel(realtimeChannel);
  realtimeChannel = null;
  logger.log("[Realtime] Unsubscribed");
};

// Handle realtime changes from other devices
const _handleRealtimeChange = async (
  table: string,
  payload: {
    eventType: string;
    new: Record<string, unknown> | null;
    old: Record<string, unknown> | null;
  }
) => {
  logger.log("[Realtime] Change received:", table, payload.eventType);

  try {
    switch (table) {
      case "moods":
        if (payload.eventType === "DELETE") {
          const oldId = payload.old?.id;
          if (typeof oldId === "string" && oldId.length > 0) await db.moods.delete(oldId);
        } else if (payload.new) {
          const moodData = payload.new;
          const mapped = {
            id: moodData.id,
            mood: moodData.mood,
            note: moodData.note || undefined,
            date: moodData.date,
            timestamp: moodData.timestamp ?? Date.now(),
            tags: Array.isArray(moodData.tags) ? moodData.tags : [],
            emotion: moodData.emotion || undefined,
            // State of Mind fields
            valence: typeof moodData.valence === "number" ? moodData.valence : undefined,
            logType: moodData.log_type || undefined,
            emotionTags: Array.isArray(moodData.emotion_tags) ? moodData.emotion_tags : undefined,
            contexts: Array.isArray(moodData.contexts) ? moodData.contexts : undefined,
          };
          const validated = runtimeMoodEntrySchema.safeParse(mapped);
          if (validated.success) {
            await db.moods.put(validated.data as MoodEntry);
          } else {
            logger.warn(
              "[Realtime] Invalid mood data received, skipping:",
              validated.error.issues[0]
            );
          }
        }
        break;

      case "focus_sessions":
        if (payload.eventType === "DELETE") {
          const oldId = payload.old?.id;
          if (typeof oldId === "string" && oldId.length > 0) await db.focusSessions.delete(oldId);
        } else if (payload.new) {
          const focusData = payload.new;
          const mapped = {
            id: focusData.id,
            duration: typeof focusData.duration === "number" ? focusData.duration : 0,
            completedAt:
              typeof focusData.completed_at === "number" ? focusData.completed_at : Date.now(),
            date: focusData.date,
            label: focusData.label || undefined,
            status: focusData.status || "completed",
            reflection: typeof focusData.reflection === "number" ? focusData.reflection : undefined,
          };
          const validated = runtimeFocusSessionSchema.safeParse(mapped);
          if (validated.success) {
            await db.focusSessions.put(validated.data);
          } else {
            logger.warn(
              "[Realtime] Invalid focus session data received, skipping:",
              validated.error.issues[0]
            );
          }
        }
        break;

      case "gratitude_entries":
        if (payload.eventType === "DELETE") {
          const oldId = payload.old?.id;
          if (typeof oldId === "string" && oldId.length > 0)
            await db.gratitudeEntries.delete(oldId);
        } else if (payload.new) {
          const gratData = payload.new;
          const mapped = {
            id: gratData.id,
            text: gratData.text,
            date: gratData.date,
            timestamp: typeof gratData.timestamp === "number" ? gratData.timestamp : Date.now(),
          };
          const validated = runtimeGratitudeEntrySchema.safeParse(mapped);
          if (validated.success) {
            await db.gratitudeEntries.put(validated.data);
          } else {
            logger.warn(
              "[Realtime] Invalid gratitude data received, skipping:",
              validated.error.issues[0]
            );
          }
        }
        break;

      case "habits":
      case "habit_completions":
        // For habits, we need to refetch the full habit with completions
        // This is simpler than trying to merge partial updates
        await pullFromCloud();
        break;
    }

    // Dispatch custom event to notify UI
    window.dispatchEvent(
      new CustomEvent("realtime-sync", {
        detail: { table, event: payload.eventType },
      })
    );
  } catch (error) {
    logger.error("[Realtime] Failed to handle change:", error);
  }
};

// Suppress unused variable warning — _handleRealtimeChange is kept for future re-enablement
void _handleRealtimeChange;
// Suppress unused import warnings — these types are used in pullFromCloud data transforms
void (undefined as unknown as Habit);
void (undefined as unknown as JournalEntry);
void (undefined as unknown as JournalPhoto);
void (undefined as unknown as JournalAudio);
void isValidUUID;

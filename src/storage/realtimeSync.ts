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
import { RealtimeChannel } from "@supabase/supabase-js";
import { getDeletedHabitIds, getDeletedJournalEntryIds } from "@/storage/deletionTracker";
import {
  runtimeMoodEntrySchema,
  runtimeHabitSchema,
  runtimeFocusSessionSchema,
  runtimeGratitudeEntrySchema,
  validateArray,
} from "@/lib/schemas";
import { decodeHabitCompletionFromCloud } from "./sync/habitCompletionCodec";

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

// Import functions used by pushToCloud
import {
  processBatched,
  syncMood,
  syncHabit,
  syncFocusSession,
  syncGratitude,
  syncSetting,
  syncJournalEntry,
  syncJournalPhoto,
  syncJournalAudio,
} from "./sync";

// Track active subscriptions
let realtimeChannel: RealtimeChannel | null = null;

// ============================================
// FULL PULL FROM CLOUD
// ============================================

export const pullFromCloud = async (): Promise<boolean> => {
  const userId = await getCurrentUserId();
  // Explicit validation to prevent RLS violations with undefined user_id
  if (!supabase) return false;
  if (!userId) {
    logger.warn("[Sync] Cannot pull from cloud: User not authenticated");
    return false;
  }

  lazyCategorizedBreadcrumb("sync", "Starting pullFromCloud");

  try {
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
    ] = await Promise.all([
      supabase
        .from("moods")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(1000),
      supabase.from("habits").select("*").eq("user_id", userId).eq("is_archived", false).limit(200),
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
    ]);

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

    // Supabase data — types flow from Database interface via .from()
    const moodsData = moodsRes.data || [];
    const habitsData = habitsRes.data || [];
    const completionsData = completionsRes.data || [];
    const remindersData = remindersRes.data || [];
    const focusData = focusRes.data || [];
    const gratitudeData = gratitudeRes.data || [];
    const settingsData = settingsRes.data || [];
    const journalEntriesData = journalEntriesRes.data || [];
    const journalPhotosData = journalPhotosRes.data || [];
    const journalAudioData = journalAudioRes.data || [];

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
      const habitType = cloudHabitTypes.get(c.habit_id) ?? "boolean";
      habitEntries[c.date] = {
        value: decodeHabitCompletionFromCloud({
          habitType,
          count: c.count,
          duration: c.duration,
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
          isArchived: false,
          position: 0,
          targetValue: h.daily_target || h.target_count || 0,
          targetType: cloudType === "reduce" ? "atMost" : "atLeast",
          unit: "",
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
    ) as FocusSession[];

    const gratitudeEntries: GratitudeEntry[] = validateArray(
      runtimeGratitudeEntrySchema,
      gratitudeData.map((g) => ({
        id: g.id,
        text: g.text,
        date: g.date,
        timestamp: g.timestamp,
      })),
      "cloud-gratitudeEntries"
    ) as GratitudeEntry[];

    // Transform journal data from cloud to local format
    // Note: photos/audio only have metadata here — binary data lives in Storage
    // and will be lazily downloaded when the user views an entry
    const journalEntries: JournalEntry[] = journalEntriesData.map((e) => ({
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
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    }));

    const journalPhotos: JournalPhoto[] = journalPhotosData.map((p) => ({
      id: p.id,
      entryId: p.entry_id,
      data: "", // Binary data not stored in Supabase table — download from Storage on demand
      thumbnail: "",
      width: p.width,
      height: p.height,
      createdAt: p.created_at,
      storagePath: p.storage_path || undefined,
      storageUrl: p.storage_url || undefined,
    }));

    const journalAudioItems: JournalAudio[] = journalAudioData.map((a) => ({
      id: a.id,
      entryId: a.entry_id,
      data: "", // Binary data not stored in Supabase table — download from Storage on demand
      duration: a.duration,
      mimeType: a.mime_type,
      createdAt: a.created_at,
      storagePath: a.storage_path || undefined,
      storageUrl: a.storage_url || undefined,
    }));

    // P2-4 Fix: Save to local DB with explicit transaction error handling
    // Dexie transactions are atomic - if any operation fails, all changes roll back
    try {
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
          // Upsert all data
          if (moods.length) await db.moods.bulkPut(moods);

          // Filter out locally deleted habits before saving — prevents resurrection
          if (habits.length) {
            const deletedIds = await getDeletedHabitIds();
            const filteredHabits =
              deletedIds.size > 0 ? habits.filter((h) => !deletedIds.has(h.id)) : habits;
            if (filteredHabits.length) await db.habits.bulkPut(filteredHabits);
          }
          if (focusSessions.length) await db.focusSessions.bulkPut(focusSessions);
          if (gratitudeEntries.length) await db.gratitudeEntries.bulkPut(gratitudeEntries);

          // Journal entries: use updatedAt-based conflict resolution + deletion tracking
          if (journalEntries.length) {
            const deletedEntryIds = await getDeletedJournalEntryIds();

            const localEntries = await db.journalEntries.toArray();
            const localMap = new Map(localEntries.map((e) => [e.id, e]));
            const merged = journalEntries
              .filter((remote) => !deletedEntryIds.has(remote.id))
              .map((remote) => {
                const local = localMap.get(remote.id);
                if (!local) return remote;
                // Keep whichever has the newer updatedAt
                return local.updatedAt > remote.updatedAt ? local : remote;
              });
            if (merged.length) await db.journalEntries.bulkPut(merged);

            // Journal photos: merge — filter out deleted entries + preserve local binary data
            if (journalPhotos.length) {
              const filteredPhotos =
                deletedEntryIds.size > 0
                  ? journalPhotos.filter((p) => !deletedEntryIds.has(p.entryId))
                  : journalPhotos;
              if (filteredPhotos.length) {
                const localPhotos = await db.journalPhotos.toArray();
                const localPhotoMap = new Map(localPhotos.map((p) => [p.id, p]));
                const mergedPhotos = filteredPhotos.map((remote) => {
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
                deletedEntryIds.size > 0
                  ? journalAudioItems.filter((a) => !deletedEntryIds.has(a.entryId))
                  : journalAudioItems;
              if (filteredAudio.length) {
                const localAudio = await db.journalAudio.toArray();
                const localAudioMap = new Map(localAudio.map((a) => [a.id, a]));
                const mergedAudio = filteredAudio.map((remote) => {
                  const local = localAudioMap.get(remote.id);
                  if (local && local.data) return { ...remote, data: local.data };
                  return remote;
                });
                await db.journalAudio.bulkPut(mergedAudio);
              }
            }
          } else {
            // No journal entries to merge, but still handle photos/audio
            if (journalPhotos.length) {
              const localPhotos = await db.journalPhotos.toArray();
              const localPhotoMap = new Map(localPhotos.map((p) => [p.id, p]));
              const mergedPhotos = journalPhotos.map((remote) => {
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

            if (journalAudioItems.length) {
              const localAudio = await db.journalAudio.toArray();
              const localAudioMap = new Map(localAudio.map((a) => [a.id, a]));
              const mergedAudio = journalAudioItems.map((remote) => {
                const local = localAudioMap.get(remote.id);
                if (local && local.data) return { ...remote, data: local.data };
                return remote;
              });
              await db.journalAudio.bulkPut(mergedAudio);
            }
          }

          // Settings
          for (const s of settingsData) {
            await db.settings.put({ key: s.key, value: s.value });
          }
        }
      );
    } catch (transactionError) {
      // P2-4 Fix: Emit event for UI awareness when transaction fails
      logger.error("[Sync] Transaction failed during pullFromCloud:", transactionError);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("zenflow:sync-transaction-failed", {
            detail: {
              operation: "pullFromCloud",
              error:
                transactionError instanceof Error ? transactionError.message : "Transaction failed",
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
    // Handle AbortError gracefully
    if (isAbortError(error)) {
      lazyCategorizedBreadcrumb("sync", "pullFromCloud aborted", {}, "warning");
      logger.warn("[Sync] pullFromCloud aborted (timeout or navigation)");
      return false;
    }
    lazyCategorizedBreadcrumb(
      "sync",
      "pullFromCloud failed",
      { error: (error as Error).message },
      "error"
    );
    logger.error("[Sync] Failed to pull from cloud:", error);
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

    // Sync all data in batches to avoid overwhelming the backend
    await processBatched(moods, (m) => syncMood(m));
    await processBatched(habits, (h) => syncHabit(h));
    await processBatched(focusSessions, (f) => syncFocusSession(f));
    await processBatched(gratitudeEntries, (g) => syncGratitude(g));
    await processBatched(settings, (s) => syncSetting(s.key, s.value));
    await processBatched(journalEntries, (e) => syncJournalEntry(e));
    await processBatched(journalPhotos, (p) => syncJournalPhoto(p));
    await processBatched(journalAudio, (a) => syncJournalAudio(a));

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
            await db.focusSessions.put(validated.data as FocusSession);
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
            await db.gratitudeEntries.put(validated.data as GratitudeEntry);
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

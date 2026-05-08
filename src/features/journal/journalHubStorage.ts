import { db } from "@/storage/db";
import { logger } from "@/lib/logger";
import { formatDate } from "@/lib/utils";
import type { GratitudeEntry } from "@/types";
import type {
  JournalEntryLink,
  JournalHubPreferences,
  JournalPracticeSession,
  JournalReleaseTraceSummary,
  JournalSpace,
  JournalSpaceCapture,
  JournalSpaceCaptureField,
} from "./types";

const DEFAULT_PREFERENCES_ID = "default";
export const QUIET_RELEASE_PRACTICE_ID = "quiet-release";
export const GRATITUDE_SPACE_ID = "space-gratitude";

const now = () => Date.now();

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const DEFAULT_JOURNAL_HUB_PREFERENCES: JournalHubPreferences = {
  id: DEFAULT_PREFERENCES_ID,
  homeView: "today",
  visibleViews: ["today", "entries", "spaces", "practices", "library"],
  dockActions: ["write", "quickNote", "gratitude", "resetThought", "template"],
  density: "balanced",
  motion: "system",
  background: "depth",
  updatedAt: 0,
};

export const DEFAULT_JOURNAL_SPACES: JournalSpace[] = [];

const LEGACY_SYSTEM_SPACE_IDS = new Set(["space-personal", "space-projects", "space-ideas", "space-private"]);

const GRATITUDE_SPACE_TEMPLATE: JournalSpace = {
  id: GRATITUDE_SPACE_ID,
  nameKey: "journalHubSpaceGratitude",
  descriptionKey: "journalHubSpaceGratitudeDesc",
  iconKey: "sprout",
  accent: "mint",
  private: false,
  kind: "system",
  coverKey: "gratitude",
  autoSource: "gratitude",
  locked: true,
  pinnedAction: "gratitude",
  sortOrder: 15,
  createdAt: 0,
  updatedAt: 0,
};

export async function getJournalHubPreferences(): Promise<JournalHubPreferences> {
  try {
    const saved = await db.journalHubPreferences.get(DEFAULT_PREFERENCES_ID);
    return { ...DEFAULT_JOURNAL_HUB_PREFERENCES, ...saved, id: DEFAULT_PREFERENCES_ID };
  } catch (error) {
    logger.error("[JournalHub] Failed to load preferences", error);
    return DEFAULT_JOURNAL_HUB_PREFERENCES;
  }
}

export async function saveJournalHubPreferences(
  patch: Partial<Omit<JournalHubPreferences, "id" | "updatedAt">>,
): Promise<JournalHubPreferences> {
  const current = await getJournalHubPreferences();
  const next: JournalHubPreferences = {
    ...current,
    ...patch,
    id: DEFAULT_PREFERENCES_ID,
    updatedAt: now(),
  };

  await db.journalHubPreferences.put(next);
  return next;
}

export async function resetJournalHubPreferences(): Promise<JournalHubPreferences> {
  const next = { ...DEFAULT_JOURNAL_HUB_PREFERENCES, updatedAt: now() };
  await db.journalHubPreferences.put(next);
  return next;
}

export async function getJournalSpaces(): Promise<JournalSpace[]> {
  try {
    const spaces = await db.journalSpaces.toArray();
    return spaces
      .filter((space) => {
        if (space.id === GRATITUDE_SPACE_ID || space.autoSource === "gratitude") return true;
        if (LEGACY_SYSTEM_SPACE_IDS.has(space.id)) return false;
        return space.kind !== "system";
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  } catch (error) {
    logger.error("[JournalHub] Failed to load spaces", error);
    return DEFAULT_JOURNAL_SPACES;
  }
}

export async function ensureGratitudeSpace(): Promise<JournalSpace> {
  const timestamp = now();
  const saved = await db.journalSpaces.get(GRATITUDE_SPACE_ID);
  const next: JournalSpace = {
    ...GRATITUDE_SPACE_TEMPLATE,
    ...saved,
    id: GRATITUDE_SPACE_ID,
    nameKey: saved?.name ? saved.nameKey : GRATITUDE_SPACE_TEMPLATE.nameKey,
    descriptionKey: saved?.descriptionKey ?? GRATITUDE_SPACE_TEMPLATE.descriptionKey,
    iconKey: saved?.iconKey ?? GRATITUDE_SPACE_TEMPLATE.iconKey,
    accent: saved?.accent ?? GRATITUDE_SPACE_TEMPLATE.accent,
    private: saved?.private ?? GRATITUDE_SPACE_TEMPLATE.private,
    kind: "system",
    autoSource: "gratitude",
    locked: true,
    coverKey: saved?.coverKey ?? GRATITUDE_SPACE_TEMPLATE.coverKey,
    pinnedAction: saved?.pinnedAction ?? GRATITUDE_SPACE_TEMPLATE.pinnedAction,
    sortOrder: saved?.sortOrder ?? GRATITUDE_SPACE_TEMPLATE.sortOrder,
    createdAt: saved?.createdAt ?? timestamp,
    updatedAt: saved?.updatedAt ?? timestamp,
  };

  if (
    !saved ||
    saved.kind !== "system" ||
    saved.autoSource !== "gratitude" ||
    saved.locked !== true ||
    saved.coverKey == null
  ) {
    await db.journalSpaces.put(next);
  }
  return next;
}

export async function saveJournalSpace(
  space: Omit<JournalSpace, "createdAt" | "updatedAt"> & Partial<Pick<JournalSpace, "createdAt">>,
): Promise<JournalSpace> {
  const timestamp = now();
  const next: JournalSpace = {
    ...space,
    createdAt: space.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  await db.journalSpaces.put(next);
  return next;
}

export async function deleteJournalSpace(spaceId: string): Promise<void> {
  const space = await db.journalSpaces.get(spaceId);
  if (space?.locked) {
    logger.warn("[JournalHub] Refused to delete locked space", { spaceId });
    return;
  }
  await db.journalSpaces.delete(spaceId);
}

export async function createJournalPracticeSession(
  input: Pick<JournalPracticeSession, "practiceId"> &
    Partial<Pick<JournalPracticeSession, "entryId" | "durationSeconds" | "startedAt" | "completedAt">>,
): Promise<JournalPracticeSession> {
  const startedAt = input.startedAt ?? now();
  const session: JournalPracticeSession = {
    id: createId("practice"),
    practiceId: input.practiceId,
    entryId: input.entryId,
    durationSeconds: input.durationSeconds,
    startedAt,
    completedAt: input.completedAt ?? startedAt,
  };

  await db.journalPracticeSessions.put(session);
  return session;
}

export async function createQuietReleaseSession(input: {
  durationSeconds?: number;
  completedAt?: number;
} = {}): Promise<JournalPracticeSession> {
  const durationSeconds = input.durationSeconds ?? 4;
  const completedAt = input.completedAt ?? now();
  return createJournalPracticeSession({
    practiceId: QUIET_RELEASE_PRACTICE_ID,
    durationSeconds,
    startedAt: completedAt - durationSeconds * 1000,
    completedAt,
  });
}

export async function getQuietReleaseSessions(): Promise<JournalPracticeSession[]> {
  try {
    const sessions = await db.journalPracticeSessions
      .where("practiceId")
      .equals(QUIET_RELEASE_PRACTICE_ID)
      .toArray();
    return sessions.sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt));
  } catch (error) {
    logger.error("[JournalHub] Failed to load quiet release sessions", error);
    return [];
  }
}

export function summarizeQuietReleaseSessionsByDate(
  sessions: JournalPracticeSession[],
): Map<string, JournalReleaseTraceSummary> {
  const traces = new Map<string, JournalReleaseTraceSummary>();
  for (const session of sessions) {
    const timestamp = session.completedAt ?? session.startedAt;
    const date = formatDate(new Date(timestamp));
    const current = traces.get(date);
    if (!current) {
      traces.set(date, { date, count: 1, latestAt: timestamp });
      continue;
    }
    traces.set(date, {
      date,
      count: current.count + 1,
      latestAt: Math.max(current.latestAt, timestamp),
    });
  }
  return traces;
}

export async function getQuietReleaseTraceSummaries(): Promise<Map<string, JournalReleaseTraceSummary>> {
  return summarizeQuietReleaseSessionsByDate(await getQuietReleaseSessions());
}

export async function linkJournalEntry(
  input: Pick<JournalEntryLink, "entryId" | "targetType" | "targetId">,
): Promise<JournalEntryLink> {
  const link: JournalEntryLink = {
    id: createId("entry-link"),
    entryId: input.entryId,
    targetType: input.targetType,
    targetId: input.targetId,
    createdAt: now(),
  };

  await db.journalEntryLinks.put(link);
  return link;
}

export async function getJournalEntryLinks(entryId: string): Promise<JournalEntryLink[]> {
  return db.journalEntryLinks.where("entryId").equals(entryId).toArray();
}

export async function linkEntryToSpace(entryId: string, spaceId: string): Promise<JournalEntryLink> {
  const existing = (await getJournalEntryLinks(entryId)).find(
    (link) => link.targetType === "space" && link.targetId === spaceId,
  );
  if (existing) return existing;
  return linkJournalEntry({ entryId, targetType: "space", targetId: spaceId });
}

export async function unlinkEntryFromSpace(entryId: string, spaceId: string): Promise<void> {
  const links = await getJournalEntryLinks(entryId);
  await Promise.all(
    links
      .filter((link) => link.targetType === "space" && link.targetId === spaceId)
      .map((link) => db.journalEntryLinks.delete(link.id)),
  );
}

export async function getSpaceEntryLinks(spaceId?: string): Promise<JournalEntryLink[]> {
  try {
    const links = await db.journalEntryLinks.where("targetType").equals("space").toArray();
    const scoped = spaceId ? links.filter((link) => link.targetId === spaceId) : links;
    return scoped.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    logger.error("[JournalHub] Failed to load space entry links", error);
    return [];
  }
}

export async function getJournalSpaceCaptures(spaceId?: string): Promise<JournalSpaceCapture[]> {
  try {
    const captures = spaceId
      ? await db.journalSpaceCaptures.where("spaceId").equals(spaceId).toArray()
      : await db.journalSpaceCaptures.toArray();
    return captures.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    logger.error("[JournalHub] Failed to load space captures", error);
    return [];
  }
}

export async function createJournalSpaceCapture(input: {
  spaceId: string;
  spaceName: string;
  mode: string;
  title: string;
  fields: JournalSpaceCaptureField[];
  date: string;
  entryId?: string;
  sourceType?: "gratitude";
  sourceId?: string;
}): Promise<JournalSpaceCapture> {
  const timestamp = now();
  const capture: JournalSpaceCapture = {
    id: createId("space-capture"),
    spaceId: input.spaceId,
    spaceName: input.spaceName,
    mode: input.mode,
    title: input.title,
    fields: input.fields,
    date: input.date,
    createdAt: timestamp,
    updatedAt: timestamp,
    entryId: input.entryId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
  };

  await db.journalSpaceCaptures.put(capture);
  return capture;
}

export async function createGratitudeSpaceCapture(entry: GratitudeEntry): Promise<JournalSpaceCapture> {
  const space = await ensureGratitudeSpace();
  const existing = (await getJournalSpaceCaptures(GRATITUDE_SPACE_ID)).find(
    (capture) => capture.sourceType === "gratitude" && capture.sourceId === entry.id,
  );
  if (existing) return existing;

  return createJournalSpaceCapture({
    spaceId: GRATITUDE_SPACE_ID,
    spaceName: space.name || "My gratitudes",
    mode: "gratitude",
    title: "gratitude",
    fields: [{ prompt: "gratitude", value: entry.text }],
    date: entry.date,
    sourceType: "gratitude",
    sourceId: entry.id,
  });
}

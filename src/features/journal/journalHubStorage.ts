import { db } from "@/storage/db";
import { logger } from "@/lib/logger";
import { formatDate } from "@/lib/utils";
import {
  decryptJournalContentIfNeeded,
  encryptJournalContent,
  isEncryptedJournalContent,
} from "./journalCrypto";
import { runWithJournalSecurityWriteLock } from "./journalSecurityWriteLock";
import { getJournalVaultKeyForWrite, JournalWriteLockedError } from "./journalWriteSecurity";
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

interface JournalHubReadContext {
  vaultKey: string | null;
  protectedAndLocked: boolean;
}

async function getJournalHubReadContext(): Promise<JournalHubReadContext> {
  try {
    return {
      vaultKey: await getJournalVaultKeyForWrite(),
      protectedAndLocked: false,
    };
  } catch (error) {
    if (error instanceof JournalWriteLockedError) {
      return { vaultKey: null, protectedAndLocked: true };
    }
    throw error;
  }
}

async function protectHubString(value: string | undefined, vaultKey: string): Promise<string | undefined> {
  if (!value || isEncryptedJournalContent(value)) return value;
  return encryptJournalContent(value, vaultKey);
}

async function revealHubString(
  value: string | undefined,
  context: JournalHubReadContext
): Promise<string | undefined> {
  if (!value) return value;
  if (context.protectedAndLocked) return undefined;
  if (!isEncryptedJournalContent(value)) return value;
  if (!context.vaultKey) return undefined;
  try {
    return await decryptJournalContentIfNeeded(value, context.vaultKey);
  } catch (error) {
    logger.warn("[JournalHub] Protected field could not be decrypted", error);
    return undefined;
  }
}

async function decryptHubStringForStorage(
  value: string | undefined,
  vaultKey: string
): Promise<string | undefined> {
  if (!value || !isEncryptedJournalContent(value)) return value;
  // Storage migration must be lossless. Unlike UI reads, authentication or
  // corruption failures propagate so password removal can roll back instead
  // of persisting redacted/empty fields as if decryption succeeded.
  return decryptJournalContentIfNeeded(value, vaultKey);
}

export async function encryptJournalSpaceForStorage(
  space: JournalSpace,
  vaultKey: string
): Promise<JournalSpace> {
  return {
    ...space,
    name: await protectHubString(space.name, vaultKey),
    description: await protectHubString(space.description, vaultKey),
  };
}

export async function encryptJournalSpaceCaptureForStorage(
  capture: JournalSpaceCapture,
  vaultKey: string
): Promise<JournalSpaceCapture> {
  return {
    ...capture,
    spaceName: (await protectHubString(capture.spaceName, vaultKey)) ?? "",
    title: (await protectHubString(capture.title, vaultKey)) ?? "",
    fields: await Promise.all(
      capture.fields.map(async (field) => ({
        prompt: (await protectHubString(field.prompt, vaultKey)) ?? "",
        value: (await protectHubString(field.value, vaultKey)) ?? "",
      }))
    ),
  };
}

async function revealJournalSpace(
  space: JournalSpace,
  context: JournalHubReadContext
): Promise<JournalSpace> {
  return {
    ...space,
    name: await revealHubString(space.name, context),
    description: await revealHubString(space.description, context),
  };
}

async function revealJournalSpaceCapture(
  capture: JournalSpaceCapture,
  context: JournalHubReadContext
): Promise<JournalSpaceCapture> {
  if (context.protectedAndLocked) {
    return { ...capture, spaceName: "", title: "", fields: [] };
  }
  return {
    ...capture,
    spaceName: (await revealHubString(capture.spaceName, context)) ?? "",
    title: (await revealHubString(capture.title, context)) ?? "",
    fields: await Promise.all(
      capture.fields.map(async (field) => ({
        prompt: (await revealHubString(field.prompt, context)) ?? "",
        value: (await revealHubString(field.value, context)) ?? "",
      }))
    ),
  };
}

function hasEncryptedSpaceFields(space: JournalSpace): boolean {
  return Boolean(
    (space.name && isEncryptedJournalContent(space.name)) ||
      (space.description && isEncryptedJournalContent(space.description))
  );
}

function hasEncryptedCaptureFields(capture: JournalSpaceCapture): boolean {
  return Boolean(
    isEncryptedJournalContent(capture.spaceName) ||
      isEncryptedJournalContent(capture.title) ||
      capture.fields.some(
        (field) =>
          isEncryptedJournalContent(field.prompt) || isEncryptedJournalContent(field.value)
      )
  );
}

function hasPlaintextSpaceFields(space: JournalSpace): boolean {
  return Boolean(
    (space.name && !isEncryptedJournalContent(space.name)) ||
      (space.description && !isEncryptedJournalContent(space.description))
  );
}

function hasPlaintextCaptureFields(capture: JournalSpaceCapture): boolean {
  return Boolean(
    (capture.spaceName && !isEncryptedJournalContent(capture.spaceName)) ||
      (capture.title && !isEncryptedJournalContent(capture.title)) ||
      capture.fields.some(
        (field) =>
          Boolean(field.prompt && !isEncryptedJournalContent(field.prompt)) ||
          Boolean(field.value && !isEncryptedJournalContent(field.value))
      )
  );
}

export async function decryptJournalSpaceForStorage(
  space: JournalSpace,
  vaultKey: string
): Promise<JournalSpace> {
  return {
    ...space,
    name: await decryptHubStringForStorage(space.name, vaultKey),
    description: await decryptHubStringForStorage(space.description, vaultKey),
  };
}

export async function decryptJournalSpaceCaptureForStorage(
  capture: JournalSpaceCapture,
  vaultKey: string
): Promise<JournalSpaceCapture> {
  return {
    ...capture,
    spaceName: (await decryptHubStringForStorage(capture.spaceName, vaultKey)) ?? "",
    title: (await decryptHubStringForStorage(capture.title, vaultKey)) ?? "",
    fields: await Promise.all(
      capture.fields.map(async (field) => ({
        prompt: (await decryptHubStringForStorage(field.prompt, vaultKey)) ?? "",
        value: (await decryptHubStringForStorage(field.value, vaultKey)) ?? "",
      }))
    ),
  };
}

export async function hasEncryptedJournalHubContent(): Promise<boolean> {
  const [spaces, captures] = await Promise.all([
    db.journalSpaces.toArray(),
    db.journalSpaceCaptures.toArray(),
  ]);
  return spaces.some(hasEncryptedSpaceFields) || captures.some(hasEncryptedCaptureFields);
}

export async function decryptEncryptedJournalHubContent(vaultKey: string): Promise<number> {
  const [spaces, captures] = await Promise.all([
    db.journalSpaces.toArray(),
    db.journalSpaceCaptures.toArray(),
  ]);
  const encryptedSpaces = spaces.filter(hasEncryptedSpaceFields);
  const encryptedCaptures = captures.filter(hasEncryptedCaptureFields);
  const [spaceUpdates, captureUpdates] = await Promise.all([
    Promise.all(encryptedSpaces.map((space) => decryptJournalSpaceForStorage(space, vaultKey))),
    Promise.all(
      encryptedCaptures.map((capture) => decryptJournalSpaceCaptureForStorage(capture, vaultKey))
    ),
  ]);
  if (spaceUpdates.length === 0 && captureUpdates.length === 0) return 0;
  await db.transaction("rw", [db.journalSpaces, db.journalSpaceCaptures], async () => {
    if (spaceUpdates.length) await db.journalSpaces.bulkPut(spaceUpdates);
    if (captureUpdates.length) await db.journalSpaceCaptures.bulkPut(captureUpdates);
  });
  return spaceUpdates.length + captureUpdates.length;
}

export async function encryptPlaintextJournalHubContent(vaultKey: string): Promise<number> {
  const [spaces, captures] = await Promise.all([
    db.journalSpaces.toArray(),
    db.journalSpaceCaptures.toArray(),
  ]);
  const plaintextSpaces = spaces.filter(hasPlaintextSpaceFields);
  const plaintextCaptures = captures.filter(hasPlaintextCaptureFields);
  const [spaceUpdates, captureUpdates] = await Promise.all([
    Promise.all(plaintextSpaces.map((space) => encryptJournalSpaceForStorage(space, vaultKey))),
    Promise.all(
      plaintextCaptures.map((capture) => encryptJournalSpaceCaptureForStorage(capture, vaultKey))
    ),
  ]);
  if (spaceUpdates.length === 0 && captureUpdates.length === 0) return 0;
  await db.transaction("rw", [db.journalSpaces, db.journalSpaceCaptures], async () => {
    if (spaceUpdates.length) await db.journalSpaces.bulkPut(spaceUpdates);
    if (captureUpdates.length) await db.journalSpaceCaptures.bulkPut(captureUpdates);
  });
  return spaceUpdates.length + captureUpdates.length;
}

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
  return runWithJournalSecurityWriteLock(async () => {
    const current = await getJournalHubPreferences();
    const next: JournalHubPreferences = {
      ...current,
      ...patch,
      id: DEFAULT_PREFERENCES_ID,
      updatedAt: now(),
    };

    await db.journalHubPreferences.put(next);
    return next;
  });
}

export async function resetJournalHubPreferences(): Promise<JournalHubPreferences> {
  return runWithJournalSecurityWriteLock(async () => {
    const next = { ...DEFAULT_JOURNAL_HUB_PREFERENCES, updatedAt: now() };
    await db.journalHubPreferences.put(next);
    return next;
  });
}

export async function getJournalSpaces(): Promise<JournalSpace[]> {
  try {
    const [spaces, context] = await Promise.all([
      db.journalSpaces.toArray(),
      getJournalHubReadContext(),
    ]);
    const visibleSpaces = spaces
      .filter((space) => {
        if (space.id === GRATITUDE_SPACE_ID || space.autoSource === "gratitude") return true;
        if (LEGACY_SYSTEM_SPACE_IDS.has(space.id)) return false;
        return space.kind !== "system";
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return Promise.all(visibleSpaces.map((space) => revealJournalSpace(space, context)));
  } catch (error) {
    logger.error("[JournalHub] Failed to load spaces", error);
    return DEFAULT_JOURNAL_SPACES;
  }
}

export async function ensureGratitudeSpace(): Promise<JournalSpace> {
  return runWithJournalSecurityWriteLock(async () => {
    const timestamp = now();
    const [saved, context] = await Promise.all([
      db.journalSpaces.get(GRATITUDE_SPACE_ID),
      getJournalHubReadContext(),
    ]);
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
    const needsRepair =
      !saved ||
      saved.kind !== "system" ||
      saved.autoSource !== "gratitude" ||
      saved.locked !== true ||
      saved.coverKey == null;
    let stored = next;

    if (needsRepair) {
      if (context.protectedAndLocked) throw new JournalWriteLockedError();
      stored = context.vaultKey
        ? await encryptJournalSpaceForStorage(next, context.vaultKey)
        : next;
      await db.journalSpaces.put(stored);
    }

    return revealJournalSpace(stored, context);
  });
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

  await runWithJournalSecurityWriteLock(async () => {
    const vaultKey = await getJournalVaultKeyForWrite();
    await db.journalSpaces.put(
      vaultKey ? await encryptJournalSpaceForStorage(next, vaultKey) : next
    );
  });
  return next;
}

export async function deleteJournalSpace(spaceId: string): Promise<void> {
  await runWithJournalSecurityWriteLock(async () => {
    const space = await db.journalSpaces.get(spaceId);
    if (space?.locked) {
      logger.warn("[JournalHub] Refused to delete locked space", { spaceId });
      return;
    }
    await db.journalSpaces.delete(spaceId);
  });
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

  await runWithJournalSecurityWriteLock(() => db.journalPracticeSessions.put(session));
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

  await runWithJournalSecurityWriteLock(() => db.journalEntryLinks.put(link));
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
  await runWithJournalSecurityWriteLock(async () => {
    const links = await getJournalEntryLinks(entryId);
    await Promise.all(
      links
        .filter((link) => link.targetType === "space" && link.targetId === spaceId)
        .map((link) => db.journalEntryLinks.delete(link.id)),
    );
  });
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
    const [captures, context] = await Promise.all([
      spaceId
        ? db.journalSpaceCaptures.where("spaceId").equals(spaceId).toArray()
        : db.journalSpaceCaptures.toArray(),
      getJournalHubReadContext(),
    ]);
    const sorted = captures.sort((a, b) => b.createdAt - a.createdAt);
    return Promise.all(sorted.map((capture) => revealJournalSpaceCapture(capture, context)));
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

  await runWithJournalSecurityWriteLock(async () => {
    const vaultKey = await getJournalVaultKeyForWrite();
    await db.journalSpaceCaptures.put(
      vaultKey ? await encryptJournalSpaceCaptureForStorage(capture, vaultKey) : capture
    );
  });
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

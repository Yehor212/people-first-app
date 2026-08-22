import { JOURNAL_CONTENT_ENCRYPTION_PREFIX } from "@/features/journal/journalCrypto";
import { sanitizeString } from "@/lib/sanitize";
import { z } from "zod";

import { hashAutomationValue } from "../canonicalJson";
import {
  isCanonicalDate,
  noOp,
  type AutomationRuleMutationResult,
  type AutomationRulePlannerContext,
} from "../plannerContracts";

const moodSourceSchema = z
  .object({
    id: z.string().min(1).max(512),
    date: z.string(),
    note: z.string().max(100_000).nullable().optional(),
    timestamp: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    updatedAt: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  })
  .passthrough();

function existingCreatedAt(value: unknown, expectedId: string): number | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    row.id !== expectedId ||
    typeof row.created_at !== "number" ||
    !Number.isSafeInteger(row.created_at) ||
    row.created_at < 0
  ) {
    return null;
  }
  return row.created_at;
}

export async function planMoodToJournalMutation({
  input,
  targetIdentity,
}: AutomationRulePlannerContext): Promise<AutomationRuleMutationResult> {
  const sourceRecord = moodSourceSchema.safeParse(input.sourceRecord);
  if (
    !sourceRecord.success ||
    sourceRecord.data.id !== input.source.id ||
    !isCanonicalDate(sourceRecord.data.date)
  ) {
    return noOp("SOURCE_INVALID");
  }

  const sanitizedNote = sanitizeString(sourceRecord.data.note ?? "");
  if (!sanitizedNote) return noOp("SOURCE_EMPTY");

  const protection = input.journalProtection;
  const normalizedTitle = protection?.localizedTitle.trim() ?? "";
  if (
    !protection ||
    normalizedTitle.length === 0 ||
    normalizedTitle.length > 160 ||
    sanitizeString(normalizedTitle) !== normalizedTitle ||
    protection.protectedContent.length > 16_384 ||
    !protection.protectedContent.startsWith(JOURNAL_CONTENT_ENCRYPTION_PREFIX) ||
    !/^sha256:[a-f0-9]{64}$/u.test(protection.sanitizedNoteHash) ||
    (await hashAutomationValue(sanitizedNote)) !== protection.sanitizedNoteHash
  ) {
    return noOp("SOURCE_INVALID");
  }

  if (input.target.value !== null && !input.target.automationOwned) {
    return noOp("TARGET_NOT_AUTOMATION_OWNED");
  }
  const createdAt =
    input.target.value === null
      ? input.source.committedAt
      : existingCreatedAt(input.target.value, targetIdentity.entityId);
  if (createdAt === null) return noOp("SOURCE_INVALID");

  return {
    kind: "mutation",
    after: {
      id: targetIdentity.entityId,
      date: sourceRecord.data.date,
      title: normalizedTitle,
      content: protection.protectedContent,
      stickers: [],
      mood: null,
      tags: [],
      template_id: null,
      habit_snapshot: null,
      photo_ids: [],
      audio_ids: [],
      created_at: createdAt,
      updated_at: input.source.committedAt,
      theme: null,
      font: null,
      ink_color: null,
      paper_texture: null,
      bg_pattern: null,
      paper_color: null,
      bg_intensity: null,
      particle_speed: null,
      font_size: null,
      photo_layout: null,
    },
  };
}

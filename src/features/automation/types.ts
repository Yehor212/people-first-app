import { z } from "zod";

export const AUTOMATION_RULE_IDS = [
  "mood.note-to-journal.v1",
  "journal.mood-to-checkin.v1",
  "focus.to-mapped-habit.v1",
  "habit.to-planning.v1",
] as const;

export const AUTOMATION_TRANSACTION_MAX_CIPHERTEXT_LENGTH = 90_000;
export const AUTOMATION_PREFERENCE_SETTING_KEY = "zenflow-connected-records-preferences";
export const AUTOMATION_REMOTE_EVENT_LIMIT = 512;
export const AUTOMATION_HISTORY_SNAPSHOT_PAGE_SIZE = 128;

const MAX_ID_LENGTH = 512;
const MAX_RULE_MAPPINGS = 100;

function sameStringSets(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

const safeTimestampSchema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);
const boundedIdSchema = z.string().min(1).max(MAX_ID_LENGTH);
export const automationSourceKeySchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export const automationRuleIdSchema = z.enum(AUTOMATION_RULE_IDS);
export type AutomationRuleId = z.infer<typeof automationRuleIdSchema>;

export const automationSourceTypeSchema = z.enum(["mood", "journal", "focus", "habit"]);
export type AutomationSourceType = z.infer<typeof automationSourceTypeSchema>;

const ruleSourceTypes: Record<AutomationRuleId, AutomationSourceType> = {
  "mood.note-to-journal.v1": "mood",
  "journal.mood-to-checkin.v1": "journal",
  "focus.to-mapped-habit.v1": "focus",
  "habit.to-planning.v1": "habit",
};

export const automationPreferenceSchema = z
  .object({
    schemaVersion: z.literal(1),
    enabled: z.boolean().default(false),
    serverRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
    consentEpoch: z.string().uuid().nullable().default(null),
    consentedAt: safeTimestampSchema.nullable().default(null),
    revokedAt: safeTimestampSchema.nullable().default(null),
    revocationPending: z.boolean().default(false),
    enabledRuleIds: z.array(automationRuleIdSchema).max(AUTOMATION_RULE_IDS.length).default([]),
    focusHabitId: boundedIdSchema.nullable().default(null),
    focusMinimumMinutes: z.number().int().min(1).max(1440).default(25),
    planningHabitMappings: z.record(boundedIdSchema, boundedIdSchema).default({}),
    updatedAt: safeTimestampSchema,
  })
  .strict()
  .superRefine((preference, ctx) => {
    if (preference.enabled && preference.consentedAt === null) {
      ctx.addIssue({
        code: "custom",
        path: ["consentedAt"],
        message: "Connected records require an explicit consent timestamp",
      });
    }

    if (preference.enabled && preference.consentEpoch === null) {
      ctx.addIssue({
        code: "custom",
        path: ["consentEpoch"],
        message: "Enabled connected records require a current consent epoch",
      });
    }

    if (preference.enabled && preference.serverRevision < 1) {
      ctx.addIssue({
        code: "custom",
        path: ["serverRevision"],
        message: "Enabled connected records require a server-accepted preference revision",
      });
    }

    if (preference.enabled && preference.revokedAt !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["revokedAt"],
        message: "An active connected-records preference cannot also be revoked",
      });
    }

    if (!preference.enabled && preference.consentEpoch !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["consentEpoch"],
        message: "Disabled connected records cannot retain an active consent epoch",
      });
    }

    if (
      preference.revocationPending &&
      (preference.enabled || preference.consentEpoch !== null || preference.revokedAt === null)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["revocationPending"],
        message: "A pending revocation must be disabled, epoch-free and timestamped",
      });
    }

    if (new Set(preference.enabledRuleIds).size !== preference.enabledRuleIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["enabledRuleIds"],
        message: "Connected-record rule IDs must be unique",
      });
    }

    if (
      preference.consentedAt !== null &&
      preference.revokedAt !== null &&
      preference.revokedAt < preference.consentedAt
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["revokedAt"],
        message: "Revocation cannot precede consent",
      });
    }

    if (Object.keys(preference.planningHabitMappings).length > MAX_RULE_MAPPINGS) {
      ctx.addIssue({
        code: "custom",
        path: ["planningHabitMappings"],
        message: `Planning mappings cannot exceed ${MAX_RULE_MAPPINGS}`,
      });
    }
  });

export type AutomationPreference = z.infer<typeof automationPreferenceSchema>;

export const automationSourceEventSchema = z
  .object({
    schemaVersion: z.literal(1),
    type: automationSourceTypeSchema,
    id: boundedIdSchema,
    revision: z.string().min(1).max(MAX_ID_LENGTH),
    committedAt: safeTimestampSchema,
  })
  .strict();

export type AutomationSourceEvent = z.infer<typeof automationSourceEventSchema>;

export const automationSourceIntentSchema = z
  .object({
    kind: z.literal("source_pending"),
    id: boundedIdSchema,
    schemaVersion: z.literal(1),
    ownerUserId: z.string().uuid(),
    consentEpoch: z.string().uuid(),
    accountBoundaryGeneration: boundedIdSchema,
    source: automationSourceEventSchema,
    candidateRuleIds: z
      .array(automationRuleIdSchema)
      .min(1)
      .max(AUTOMATION_RULE_IDS.length),
    sourceKey: automationSourceKeySchema,
    createdAt: safeTimestampSchema,
    updatedAt: safeTimestampSchema,
  })
  .strict()
  .superRefine((intent, ctx) => {
    if (intent.updatedAt < intent.createdAt) {
      ctx.addIssue({
        code: "custom",
        path: ["updatedAt"],
        message: "Source-intent update time cannot precede creation",
      });
    }
    if (new Set(intent.candidateRuleIds).size !== intent.candidateRuleIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["candidateRuleIds"],
        message: "Source-intent candidate rules must be unique",
      });
    }
    for (const [index, ruleId] of intent.candidateRuleIds.entries()) {
      if (ruleSourceTypes[ruleId] !== intent.source.type) {
        ctx.addIssue({
          code: "custom",
          path: ["candidateRuleIds", index],
          message: "Source-intent candidate rules must match the source type",
        });
      }
    }
  });

export type AutomationSourceIntent = z.infer<typeof automationSourceIntentSchema>;

export type AutomationJsonValue =
  | null
  | boolean
  | number
  | string
  | AutomationJsonValue[]
  | { [key: string]: AutomationJsonValue };

export const automationJsonValueSchema: z.ZodType<AutomationJsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(automationJsonValueSchema),
    z.record(z.string(), automationJsonValueSchema),
  ]),
);

export const automationMutationEntityTypeSchema = z.enum([
  "mood",
  "habit",
  "habit_completion",
  "focus",
  "journal",
  "setting",
]);

const automationHashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export const automationMutationSchema = z
  .object({
    entityType: automationMutationEntityTypeSchema,
    entityId: boundedIdSchema,
    operation: z.enum(["upsert", "delete"]),
    before: automationJsonValueSchema.nullable(),
    after: automationJsonValueSchema.nullable(),
    beforeHash: automationHashSchema,
    afterHash: automationHashSchema,
    beforeRevisionToken: z.string().uuid().nullable(),
    afterRevisionToken: z.string().uuid().nullable(),
  })
  .strict()
  .superRefine((mutation, ctx) => {
    if (mutation.operation === "upsert" && mutation.after === null) {
      ctx.addIssue({
        code: "custom",
        path: ["after"],
        message: "Upsert mutations require an after value",
      });
    }
    if (mutation.operation === "upsert" && mutation.afterRevisionToken === null) {
      ctx.addIssue({
        code: "custom",
        path: ["afterRevisionToken"],
        message: "Upsert mutations require an after revision token",
      });
    }
    if (
      (mutation.before === null && mutation.beforeRevisionToken !== null) ||
      (mutation.before !== null && mutation.beforeRevisionToken === null)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["beforeRevisionToken"],
        message: "Before revision token must match before-state presence",
      });
    }
    if (mutation.operation === "delete" && (mutation.before === null || mutation.after !== null)) {
      ctx.addIssue({
        code: "custom",
        path: ["operation"],
        message: "Delete mutations require a prior value and a null after value",
      });
    }
    if (
      mutation.operation === "delete" &&
      (mutation.beforeRevisionToken === null || mutation.afterRevisionToken !== null)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["afterRevisionToken"],
        message: "Delete mutations require a before token and null after token",
      });
    }
  });

export type AutomationMutation = z.infer<typeof automationMutationSchema>;

export const automationProvenanceSchema = z
  .object({
    schemaVersion: z.literal(1),
    ownerUserId: z.string().uuid(),
    transactionId: z.string().uuid(),
    consentEpoch: z.string().uuid(),
    sourceKey: automationSourceKeySchema,
    ruleId: automationRuleIdSchema,
    ruleVersion: z.literal(1),
    sourceType: automationSourceTypeSchema,
    sourceId: boundedIdSchema,
    mutationGeneration: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    recordRevisionToken: z.string().uuid(),
    afterHash: automationHashSchema,
    createdAt: safeTimestampSchema,
  })
  .strict();

export type AutomationProvenance = z.infer<typeof automationProvenanceSchema>;

export const automationRecordRevisionStoreRowSchema = z
  .object({
    kind: z.literal("record_revision"),
    id: z.string().min(1).max(MAX_ID_LENGTH * 2 + 64),
    schemaVersion: z.literal(1),
    ownerUserId: z.string().uuid(),
    entityType: automationMutationEntityTypeSchema,
    entityId: boundedIdSchema,
    recordExists: z.boolean(),
    revisionToken: z.string().uuid().nullable(),
    stateHash: automationHashSchema,
    mutationGeneration: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    transactionId: z.string().uuid().nullable(),
    updatedAt: safeTimestampSchema,
  })
  .strict()
  .superRefine((revision, ctx) => {
    if (revision.recordExists !== (revision.revisionToken !== null)) {
      ctx.addIssue({
        code: "custom",
        path: ["revisionToken"],
        message: "Existing local projections require a revision token",
      });
    }
  });

export type AutomationRecordRevisionStoreRow = z.infer<
  typeof automationRecordRevisionStoreRowSchema
>;

export const automationRevisionEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(1),
    transactionId: z.string().uuid(),
    ownerUserId: z.string().uuid(),
    consentEpoch: z.string().uuid(),
    sourceKey: automationSourceKeySchema,
    ruleId: automationRuleIdSchema,
    ruleVersion: z.literal(1),
    source: automationSourceEventSchema,
    mutations: z.array(automationMutationSchema).min(1).max(32),
    plannedAt: safeTimestampSchema,
  })
  .strict();

export type AutomationRevisionEnvelope = z.infer<typeof automationRevisionEnvelopeSchema>;

export const automationRevisionBindingSchema = z
  .object({
    schemaVersion: z.literal(1),
    transactionId: z.string().uuid(),
    ownerUserId: z.string().uuid(),
    consentEpoch: z.string().uuid(),
    sourceKey: automationSourceKeySchema,
    sourceType: automationSourceTypeSchema,
    sourceId: boundedIdSchema,
    ruleId: automationRuleIdSchema,
    ruleVersion: z.literal(1),
  })
  .strict();

export type AutomationRevisionBinding = z.infer<typeof automationRevisionBindingSchema>;

const automationRevisionCiphertextSchema = z
  .string()
  .startsWith("zenflow:automation-revision:v1:")
  .max(AUTOMATION_TRANSACTION_MAX_CIPHERTEXT_LENGTH);

export const automationTransactionStatusSchema = z.enum([
  "commit_pending",
  "committed",
  "sync_blocked",
  "commit_conflict",
  "revoked",
  "undo_pending",
  "undone",
  "conflict",
]);

export type AutomationTransactionStatus = z.infer<typeof automationTransactionStatusSchema>;

export const automationTransactionSchema = z
  .object({
      id: z.string().uuid(),
      ownerUserId: z.string().uuid(),
      consentEpoch: z.string().uuid(),
      sourceKey: automationSourceKeySchema,
    ruleId: automationRuleIdSchema,
    ruleVersion: z.literal(1),
    sourceType: automationSourceTypeSchema,
    sourceId: boundedIdSchema,
    status: automationTransactionStatusSchema,
    revisionCiphertext: automationRevisionCiphertextSchema,
    createdAt: safeTimestampSchema,
    updatedAt: safeTimestampSchema,
      undoneAt: safeTimestampSchema.optional(),
      undoTransactionId: z.string().uuid().optional(),
      serverSequence: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).optional(),
      historyGeneration: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).optional(),
    schemaVersion: z.literal(1),
  })
  .strict()
  .superRefine((transaction, ctx) => {
    if (transaction.updatedAt < transaction.createdAt) {
      ctx.addIssue({
        code: "custom",
        path: ["updatedAt"],
        message: "Transaction update time cannot precede creation",
      });
    }

    const hasServerSequence = transaction.serverSequence !== undefined;
    const hasHistoryGeneration = transaction.historyGeneration !== undefined;
    if (hasServerSequence !== hasHistoryGeneration) {
      ctx.addIssue({
        code: "custom",
        path: ["serverSequence"],
        message: "Server sequence and history generation must be present together",
      });
    }

    const requiresServerOrder = ["committed", "undo_pending", "undone", "conflict"].includes(
      transaction.status,
    );
    if (requiresServerOrder && (!hasServerSequence || !hasHistoryGeneration)) {
      ctx.addIssue({
        code: "custom",
        path: ["serverSequence"],
        message: "Server-accepted transaction states require authoritative ordering",
      });
    }
    if (!requiresServerOrder && (hasServerSequence || hasHistoryGeneration)) {
      ctx.addIssue({
        code: "custom",
        path: ["serverSequence"],
        message: "Unaccepted transaction states cannot claim server ordering",
      });
    }

    if (transaction.status === "undone") {
      if (transaction.undoneAt === undefined || !transaction.undoTransactionId) {
        ctx.addIssue({
          code: "custom",
          path: ["status"],
          message: "Undone transactions require undo metadata",
        });
      } else if (
        transaction.undoneAt < transaction.createdAt ||
        transaction.undoneAt > transaction.updatedAt
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["undoneAt"],
          message: "Undo time must be within the transaction timeline",
        });
      }
    } else if (transaction.undoneAt !== undefined || transaction.undoTransactionId !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message: "Only undone transactions may carry undo metadata",
      });
    }
  });

export type AutomationTransaction = z.infer<typeof automationTransactionSchema>;

export type AutomationTransactionStoreRow = AutomationTransaction & {
  kind: "transaction";
};

export type AutomationTransactionTableRow =
  | AutomationSourceIntent
  | AutomationRecordRevisionStoreRow
  | AutomationTransactionStoreRow
  | AutomationHistoryPurgePendingRow;

export const automationHistoryMarkerSchema = z
  .object({
    schemaVersion: z.literal(1),
    ownerUserId: z.string().uuid(),
    historyGeneration: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    snapshotSequence: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    lastAppliedServerSequence: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    bootstrapCompletedAt: safeTimestampSchema.nullable(),
    purgedTransactionIds: z.array(z.string().uuid()).optional(),
    allHistoryPurgedAt: safeTimestampSchema.optional(),
    updatedAt: safeTimestampSchema,
  })
  .strict()
  .superRefine((marker, ctx) => {
    if (marker.bootstrapCompletedAt !== null && marker.updatedAt < marker.bootstrapCompletedAt) {
      ctx.addIssue({
        code: "custom",
        path: ["updatedAt"],
        message: "History-marker update cannot precede bootstrap completion",
      });
    }
    if (
      marker.purgedTransactionIds &&
      new Set(marker.purgedTransactionIds).size !== marker.purgedTransactionIds.length
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["purgedTransactionIds"],
        message: "Purged transaction IDs must be unique",
      });
    }
    if (marker.allHistoryPurgedAt !== undefined && marker.updatedAt < marker.allHistoryPurgedAt) {
      ctx.addIssue({
        code: "custom",
        path: ["updatedAt"],
        message: "History-marker update cannot precede the all-history purge",
      });
    }
  });

export type AutomationHistoryMarker = z.infer<typeof automationHistoryMarkerSchema>;

export const automationCommitRequestSchema = z
  .object({
    schemaVersion: z.literal(1),
    transactionId: z.string().uuid(),
    consentEpoch: z.string().uuid(),
    expectedPreferenceRevision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    expectedHistoryGeneration: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    sourceKey: automationSourceKeySchema,
    ruleId: automationRuleIdSchema,
    ruleVersion: z.literal(1),
    source: automationSourceEventSchema,
    revisionCiphertext: automationRevisionCiphertextSchema,
    deviceId: boundedIdSchema,
    mutations: z.array(automationMutationSchema).min(1).max(32),
    requestedAt: safeTimestampSchema,
  })
  .strict()
  .superRefine((request, ctx) => {
    if (ruleSourceTypes[request.ruleId] !== request.source.type) {
      ctx.addIssue({
        code: "custom",
        path: ["source", "type"],
        message: "Source type must match the registered automation rule",
      });
    }
  });

export type AutomationCommitRequest = z.infer<typeof automationCommitRequestSchema>;

export const automationCommitQueueIntentSchema = z
  .object({
    schemaVersion: z.literal(1),
    transactionId: z.string().uuid(),
    expectedPreferenceRevision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    expectedHistoryGeneration: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    deviceId: boundedIdSchema,
  })
  .strict();

export type AutomationCommitQueueIntent = z.infer<
  typeof automationCommitQueueIntentSchema
>;

export const automationUndoQueueIntentSchema = z
  .object({
    schemaVersion: z.literal(1),
    operationId: z.string().uuid(),
    transactionId: z.string().uuid(),
    expectedServerSequence: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    expectedHistoryGeneration: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    deviceId: boundedIdSchema,
  })
  .strict()
  .superRefine((intent, ctx) => {
    if (intent.operationId === intent.transactionId) {
      ctx.addIssue({
        code: "custom",
        path: ["operationId"],
        message: "Undo operation identity must differ from the original transaction",
      });
    }
  });

export type AutomationUndoQueueIntent = z.infer<
  typeof automationUndoQueueIntentSchema
>;

export const automationCommitResultCodeSchema = z.enum([
  "COMMITTED",
  "ALREADY_COMMITTED",
  "STALE_CONSENT_EPOCH",
  "PREFERENCE_REVISION_CONFLICT",
  "TARGET_REVISION_CONFLICT",
  "HISTORY_GENERATION_STALE",
  "HISTORY_LIMIT_REACHED",
  "TRANSACTION_PURGED",
  "INVALID_REQUEST",
  "UNAUTHORIZED",
]);

const automationCommitAcceptedResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    code: z.enum(["COMMITTED", "ALREADY_COMMITTED"]),
    transactionId: z.string().uuid(),
    serverSequence: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    historyGeneration: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    completedAt: safeTimestampSchema,
  })
  .strict();

const automationCommitRejectedResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    code: z.enum([
      "STALE_CONSENT_EPOCH",
      "PREFERENCE_REVISION_CONFLICT",
      "TARGET_REVISION_CONFLICT",
      "HISTORY_GENERATION_STALE",
      "HISTORY_LIMIT_REACHED",
      "TRANSACTION_PURGED",
      "INVALID_REQUEST",
      "UNAUTHORIZED",
    ]),
    transactionId: z.string().uuid(),
    currentPreferenceRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    historyGeneration: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  })
  .strict();

export const automationCommitResultSchema = z.union([
  automationCommitAcceptedResultSchema,
  automationCommitRejectedResultSchema,
]);

export type AutomationCommitResult = z.infer<typeof automationCommitResultSchema>;

export const automationUndoRequestSchema = z
  .object({
    schemaVersion: z.literal(1),
    operationId: z.string().uuid(),
    transactionId: z.string().uuid(),
    expectedServerSequence: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    expectedHistoryGeneration: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    deviceId: boundedIdSchema,
    compensatingMutations: z.array(automationMutationSchema).min(1).max(32),
    requestedAt: safeTimestampSchema,
  })
  .strict()
  .superRefine((request, ctx) => {
    if (request.operationId === request.transactionId) {
      ctx.addIssue({
        code: "custom",
        path: ["operationId"],
        message: "Undo operation identity must be distinct from the original transaction",
      });
    }
  });

export type AutomationUndoRequest = z.infer<typeof automationUndoRequestSchema>;

const automationUndoAcceptedResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    code: z.enum(["UNDONE", "ALREADY_UNDONE"]),
    transactionId: z.string().uuid(),
    undoTransactionId: z.string().uuid(),
    serverSequence: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    historyGeneration: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    completedAt: safeTimestampSchema,
  })
  .strict();

const automationUndoRejectedResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    code: z.enum([
      "TARGET_REVISION_CONFLICT",
      "HISTORY_GENERATION_STALE",
      "TRANSACTION_PURGED",
      "TRANSACTION_NOT_FOUND",
      "INVALID_REQUEST",
      "UNAUTHORIZED",
    ]),
    transactionId: z.string().uuid(),
    historyGeneration: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  })
  .strict();

export const automationUndoResultSchema = z.union([
  automationUndoAcceptedResultSchema,
  automationUndoRejectedResultSchema,
]);

export type AutomationUndoResult = z.infer<typeof automationUndoResultSchema>;

export const automationHistorySnapshotTransactionSchema = z
  .object({
    id: z.string().uuid(),
    consentEpoch: z.string().uuid(),
    sourceKey: automationSourceKeySchema,
    ruleId: automationRuleIdSchema,
    ruleVersion: z.literal(1),
    sourceType: automationSourceTypeSchema,
    sourceId: boundedIdSchema,
    status: z.enum(["committed", "undone"]),
    revisionCiphertext: automationRevisionCiphertextSchema,
    createdAt: safeTimestampSchema,
    updatedAt: safeTimestampSchema,
    undoneAt: safeTimestampSchema.optional(),
    undoTransactionId: z.string().uuid().optional(),
    serverSequence: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    historyGeneration: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    schemaVersion: z.literal(1),
  })
  .strict()
  .superRefine((transaction, ctx) => {
    if (transaction.updatedAt < transaction.createdAt) {
      ctx.addIssue({
        code: "custom",
        path: ["updatedAt"],
        message: "Snapshot update time cannot precede creation",
      });
    }
    if (transaction.status === "undone") {
      if (transaction.undoneAt === undefined || transaction.undoTransactionId === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["status"],
          message: "Undone snapshot rows require undo metadata",
        });
      }
    } else if (transaction.undoneAt !== undefined || transaction.undoTransactionId !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message: "Committed snapshot rows cannot carry undo metadata",
      });
    }
  });

export type AutomationHistorySnapshotTransaction = z.infer<
  typeof automationHistorySnapshotTransactionSchema
>;

export const automationHistorySnapshotRecordRevisionSchema = z
  .object({
    entityType: z.enum(["mood", "habit_completion", "journal", "setting"]),
    entityId: boundedIdSchema,
    recordExists: z.boolean(),
    revisionToken: z.string().uuid().nullable(),
    stateHash: automationHashSchema,
    mutationGeneration: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    transactionId: z.string().uuid().nullable(),
    updatedAt: safeTimestampSchema,
  })
  .strict()
  .superRefine((revision, ctx) => {
    if (revision.recordExists !== (revision.revisionToken !== null)) {
      ctx.addIssue({
        code: "custom",
        path: ["revisionToken"],
        message: "Snapshot record existence and revision token must agree",
      });
    }
  });

export type AutomationHistorySnapshotRecordRevision = z.infer<
  typeof automationHistorySnapshotRecordRevisionSchema
>;

const automationTransactionRemoteEventSchema = z
  .object({
    id: boundedIdSchema,
    schemaVersion: z.literal(1),
    ownerUserId: z.string().uuid(),
    syncEventId: z.string().uuid(),
    syncEventSequence: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    transactionId: z.string().uuid(),
    historyGeneration: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    serverSequence: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    deliveryKind: z.enum(["delta", "snapshot"]),
    transaction: automationHistorySnapshotTransactionSchema,
    receivedAt: safeTimestampSchema,
  })
  .strict()
  .superRefine((event, ctx) => {
    if (
      event.transaction.id !== event.transactionId ||
      event.transaction.historyGeneration !== event.historyGeneration ||
      event.transaction.serverSequence !== event.serverSequence
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["transaction"],
        message: "Remote event identity and authoritative order must match its transaction",
      });
    }
  });

const automationHistoryPurgeRemoteEventSchema = z
  .object({
    id: boundedIdSchema,
    schemaVersion: z.literal(1),
    ownerUserId: z.string().uuid(),
    syncEventId: z.string().uuid(),
    syncEventSequence: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    transactionId: z.null(),
    operationId: z.string().uuid(),
    historyGeneration: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    serverSequence: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    deliveryKind: z.literal("purge"),
    purge: z.lazy(() => automationHistoryPurgeResultSchema),
    receivedAt: safeTimestampSchema,
  })
  .strict()
  .superRefine((event, ctx) => {
    if (
      event.purge.operationId !== event.operationId ||
      event.purge.historyGeneration !== event.historyGeneration ||
      event.purge.serverSequence !== event.serverSequence
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["purge"],
        message: "Remote purge identity and authoritative order must match its result",
      });
    }
  });

export const automationRemoteEventSchema = z.union([
  automationTransactionRemoteEventSchema,
  automationHistoryPurgeRemoteEventSchema,
]);

export type AutomationRemoteEvent = z.infer<typeof automationRemoteEventSchema>;

export const automationHistoryTombstoneSchema = z
  .object({
    transactionId: z.string().uuid(),
    purgedAt: safeTimestampSchema,
    serverSequence: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  })
  .strict();

export const automationHistorySnapshotTokenSchema = z
  .object({
    historyGeneration: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    snapshotSequence: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    recordRevisionVersion: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  })
  .strict();

export type AutomationHistorySnapshotToken = z.infer<
  typeof automationHistorySnapshotTokenSchema
>;

export const automationHistorySnapshotCursorSchema = z
  .object({
    transactionAfterSequence: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    tombstoneAfterSequence: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    tombstoneAfterTransactionId: z.string().uuid().nullable(),
    recordRevisionAfterEntityType: z
      .enum(["mood", "habit_completion", "journal", "setting"])
      .nullable(),
    recordRevisionAfterEntityId: boundedIdSchema.nullable(),
    transactionsComplete: z.boolean(),
    tombstonesComplete: z.boolean(),
    recordRevisionsComplete: z.boolean(),
  })
  .strict()
  .superRefine((cursor, ctx) => {
    if (
      (cursor.recordRevisionAfterEntityType === null) !==
      (cursor.recordRevisionAfterEntityId === null)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["recordRevisionAfterEntityId"],
        message: "Record-revision cursor fields must advance together",
      });
    }
  });

export type AutomationHistorySnapshotCursor = z.infer<
  typeof automationHistorySnapshotCursorSchema
>;

const automationHistorySnapshotPageSchema = z
  .object({
    schemaVersion: z.literal(2),
    code: z.literal("PAGE"),
    snapshotToken: automationHistorySnapshotTokenSchema,
    allHistoryPurgedAt: safeTimestampSchema.optional(),
    tombstones: z
      .array(automationHistoryTombstoneSchema)
      .max(AUTOMATION_HISTORY_SNAPSHOT_PAGE_SIZE),
    transactions: z
      .array(automationHistorySnapshotTransactionSchema)
      .max(AUTOMATION_HISTORY_SNAPSHOT_PAGE_SIZE),
    recordRevisions: z
      .array(automationHistorySnapshotRecordRevisionSchema)
      .max(AUTOMATION_HISTORY_SNAPSHOT_PAGE_SIZE),
    nextCursor: automationHistorySnapshotCursorSchema.nullable(),
  })
  .strict()
  .superRefine((page, ctx) => {
    let previousSequence = 0;
    const transactionIds = new Set<string>();
    for (const [index, transaction] of page.transactions.entries()) {
      if (
        transactionIds.has(transaction.id) ||
        transaction.historyGeneration !== page.snapshotToken.historyGeneration ||
        transaction.serverSequence <= previousSequence ||
        transaction.serverSequence > page.snapshotToken.snapshotSequence
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["transactions", index],
          message: "Snapshot page transactions require unique current-token server order",
        });
      }
      transactionIds.add(transaction.id);
      previousSequence = transaction.serverSequence;
    }

    const tombstoneIds = new Set<string>();
    for (const [index, tombstone] of page.tombstones.entries()) {
      if (
        tombstoneIds.has(tombstone.transactionId) ||
        transactionIds.has(tombstone.transactionId) ||
        tombstone.serverSequence > page.snapshotToken.snapshotSequence
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["tombstones", index],
          message: "Snapshot page tombstones must be unique and token-bounded",
        });
      }
      tombstoneIds.add(tombstone.transactionId);
    }

    const revisionTargets = new Set<string>();
    for (const [index, revision] of page.recordRevisions.entries()) {
      const target = `${revision.entityType}:${revision.entityId}`;
      if (revisionTargets.has(target)) {
        ctx.addIssue({
          code: "custom",
          path: ["recordRevisions", index],
          message: "Snapshot page record-revision targets must be unique",
        });
      }
      revisionTargets.add(target);
    }
  });

const automationHistorySnapshotStaleSchema = z
  .object({
    schemaVersion: z.literal(2),
    code: z.literal("SNAPSHOT_STALE"),
  })
  .strict();

export const automationHistorySnapshotPageResultSchema = z.union([
  automationHistorySnapshotPageSchema,
  automationHistorySnapshotStaleSchema,
]);

export type AutomationHistorySnapshotPageResult = z.infer<
  typeof automationHistorySnapshotPageResultSchema
>;

export const automationHistorySnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    historyGeneration: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    snapshotSequence: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    allHistoryPurgedAt: safeTimestampSchema.optional(),
    tombstones: z.array(automationHistoryTombstoneSchema),
    transactions: z.array(automationHistorySnapshotTransactionSchema).max(128),
    recordRevisions: z.array(automationHistorySnapshotRecordRevisionSchema),
  })
  .strict()
  .superRefine((snapshot, ctx) => {
    const transactionIds = new Set<string>();
    let previousSequence = 0;
    for (const [index, transaction] of snapshot.transactions.entries()) {
      if (transactionIds.has(transaction.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["transactions", index, "id"],
          message: "Snapshot transaction IDs must be unique",
        });
      }
      transactionIds.add(transaction.id);
      if (
        transaction.historyGeneration !== snapshot.historyGeneration ||
        transaction.serverSequence <= previousSequence ||
        transaction.serverSequence > snapshot.snapshotSequence
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["transactions", index, "serverSequence"],
          message: "Snapshot rows require current generation and strictly increasing server order",
        });
      }
      previousSequence = transaction.serverSequence;
    }

    const tombstoneIds = new Set<string>();
    for (const [index, tombstone] of snapshot.tombstones.entries()) {
      if (
        tombstoneIds.has(tombstone.transactionId) ||
        transactionIds.has(tombstone.transactionId) ||
        tombstone.serverSequence > snapshot.snapshotSequence
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["tombstones", index],
          message: "Snapshot tombstones must be unique, bounded, and exclude active rows",
        });
      }
      tombstoneIds.add(tombstone.transactionId);
    }

    const validRevisionTransactionIds = new Set<string>();
    for (const transaction of snapshot.transactions) {
      validRevisionTransactionIds.add(transaction.id);
      if (transaction.undoTransactionId) {
        validRevisionTransactionIds.add(transaction.undoTransactionId);
      }
    }
    const revisionTargets = new Set<string>();
    for (const [index, revision] of snapshot.recordRevisions.entries()) {
      const target = `${revision.entityType}:${revision.entityId}`;
      if (revisionTargets.has(target)) {
        ctx.addIssue({
          code: "custom",
          path: ["recordRevisions", index],
          message: "Snapshot record-revision targets must be unique",
        });
      }
      revisionTargets.add(target);
      if (
        revision.transactionId !== null &&
        !validRevisionTransactionIds.has(revision.transactionId)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["recordRevisions", index, "transactionId"],
          message: "Snapshot automation ownership must reference retained history",
        });
      }
    }
  });

export type AutomationHistorySnapshot = z.infer<typeof automationHistorySnapshotSchema>;

export const automationHistoryPurgeRequestSchema = z
  .object({
    operationId: z.string().uuid(),
    transactionIds: z.array(z.string().uuid()).max(512),
    all: z.boolean(),
    deviceId: boundedIdSchema,
  })
  .strict()
  .superRefine((request, ctx) => {
    if ((request.all && request.transactionIds.length !== 0) ||
      (!request.all && request.transactionIds.length === 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["transactionIds"],
        message: "Choose either exact transaction IDs or all connected history",
      });
    }
    if (new Set(request.transactionIds).size !== request.transactionIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["transactionIds"],
        message: "History purge transaction IDs must be unique",
      });
    }
  });

export type AutomationHistoryPurgeRequest = z.infer<
  typeof automationHistoryPurgeRequestSchema
>;

export const automationHistoryPurgePendingRowSchema = z
  .object({
    kind: z.literal("purge_pending"),
    id: boundedIdSchema,
    schemaVersion: z.literal(1),
    operationId: z.string().uuid(),
    ownerUserId: z.string().uuid(),
    transactionIds: z.array(z.string().uuid()).max(512),
    capturedTransactionIds: z.array(z.string().uuid()).max(512),
    capturedSourceIntentIds: z.array(boundedIdSchema).max(512),
    all: z.boolean(),
    deviceId: boundedIdSchema,
    acceptedResult: z.lazy(() => automationHistoryPurgeResultSchema).optional(),
    createdAt: safeTimestampSchema,
    updatedAt: safeTimestampSchema,
  })
  .strict()
  .superRefine((request, ctx) => {
    if (
      request.id !== `automation-purge:${request.operationId}` ||
      (request.all && request.transactionIds.length !== 0) ||
      (!request.all && request.transactionIds.length === 0) ||
      new Set(request.transactionIds).size !== request.transactionIds.length ||
      new Set(request.capturedTransactionIds).size !== request.capturedTransactionIds.length ||
      new Set(request.capturedSourceIntentIds).size !== request.capturedSourceIntentIds.length ||
      (!request.all &&
        (!sameStringSets(request.transactionIds, request.capturedTransactionIds) ||
          request.capturedSourceIntentIds.length !== 0)) ||
      (request.acceptedResult !== undefined &&
        (request.acceptedResult.operationId !== request.operationId ||
          (request.all !== (request.acceptedResult.allHistoryPurgedAt !== null)))) ||
      request.updatedAt < request.createdAt
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["operationId"],
        message: "Pending history purge must have one canonical operation-bound scope",
      });
    }
  });

export type AutomationHistoryPurgePendingRow = z.infer<
  typeof automationHistoryPurgePendingRowSchema
>;

export const automationHistoryPurgeResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    operationId: z.string().uuid(),
    historyGeneration: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    serverSequence: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    completedAt: safeTimestampSchema,
    allHistoryPurgedAt: safeTimestampSchema.nullable(),
    purgedTransactionIds: z.array(z.string().uuid()).max(512),
    preference: automationPreferenceSchema.nullable(),
  })
  .strict()
  .superRefine((result, ctx) => {
    if (new Set(result.purgedTransactionIds).size !== result.purgedTransactionIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["purgedTransactionIds"],
        message: "Purged transaction IDs must be unique",
      });
    }
    if (result.allHistoryPurgedAt === null && result.preference !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["preference"],
        message: "Per-item history purge cannot replace the connected-record preference",
      });
    }
    if (
      result.allHistoryPurgedAt !== null &&
      (result.preference === null ||
        result.preference.enabled ||
        result.preference.consentEpoch !== null ||
        result.preference.revokedAt === null ||
        result.preference.revocationPending)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["preference"],
        message: "All-history purge requires the exact server-disabled preference",
      });
    }
  });

export type AutomationHistoryPurgeResult = z.infer<
  typeof automationHistoryPurgeResultSchema
>;

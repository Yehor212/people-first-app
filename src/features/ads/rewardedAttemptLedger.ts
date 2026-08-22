import { z } from "zod";
import { AD_REWARDS } from "@/lib/adConfig";
import { innerWorldSchema } from "@/lib/schemas";
import { SK } from "@/lib/storageKeys";
import { runWithOriginExclusiveLock } from "@/lib/originExclusiveLock";
import {
  ACCOUNT_BOUNDARY_DATA_WRITE_LOCK,
  captureOriginAccountBoundaryGeneration,
  isOriginAccountBoundaryGenerationCurrent,
} from "@/storage/accountBoundaryRuntime";
import { db } from "@/storage/db";
import { validateSyncOwner } from "@/storage/sync/syncOwner";

export const REWARDED_ATTEMPT_LEDGER_KEY = SK.REWARDED_AD_ATTEMPT_LEDGER;

const ATTEMPT_TTL_MS = 10 * 60 * 1000;
const MAX_RETAINED_ATTEMPTS = 32;
const attemptStatusSchema = z.enum(["prepared", "earned", "dismissed", "expired"]);
const rewardedAttemptSchema = z
  .object({
    id: z.string().uuid(),
    status: attemptStatusSchema,
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    earnedAt: z.number().int().nonnegative().optional(),
  })
  .strict();

const rewardedAttemptLedgerSchema = z
  .object({
    schemaVersion: z.literal(1),
    ownerUserId: z.string().uuid(),
    attempts: z.array(rewardedAttemptSchema).max(MAX_RETAINED_ATTEMPTS),
  })
  .strict();

type RewardedAttemptLedger = z.infer<typeof rewardedAttemptLedgerSchema>;

const treatTransactionSchema = z
  .object({
    id: z.string().min(1),
    amount: z.number().finite(),
    source: z.enum([
      "mood",
      "habit",
      "focus",
      "gratitude",
      "breathing",
      "journal",
      "streak_bonus",
      "daily_reward",
      "mindful",
      "ad",
    ]),
    timestamp: z.number().int().nonnegative(),
    description: z.string().optional(),
  })
  .passthrough();

const rewardedWorldSchema = innerWorldSchema.extend({
  treats: z
    .object({
      balance: z.number().finite(),
      lifetimeEarned: z.number().finite(),
      lifetimeSpent: z.number().finite(),
      lastEarnedAt: z.number().int().nonnegative().optional(),
      transactions: z.array(treatTransactionSchema).max(50),
    })
    .passthrough(),
});

type RewardedWorld = z.infer<typeof rewardedWorldSchema>;
type RewardedTreatTransaction = z.infer<typeof treatTransactionSchema>;

export type RewardedAttemptErrorCode =
  | "REWARDED_ATTEMPT_OWNER_UNAVAILABLE"
  | "REWARDED_ATTEMPT_BOUNDARY_CHANGED"
  | "REWARDED_ATTEMPT_WALLET_UNAVAILABLE"
  | "REWARDED_ATTEMPT_LEDGER_INVALID"
  | "REWARDED_ATTEMPT_ID_UNAVAILABLE"
  | "REWARDED_ATTEMPT_NOT_FOUND"
  | "REWARDED_ATTEMPT_TERMINAL"
  | "REWARDED_ATTEMPT_WALLET_CONFLICT"
  | "REWARDED_ATTEMPT_AMOUNT_OVERFLOW";

export class RewardedAttemptError extends Error {
  readonly code: RewardedAttemptErrorCode;

  constructor(code: RewardedAttemptErrorCode) {
    super(code);
    this.name = "RewardedAttemptError";
    this.code = code;
  }
}

export type BeginRewardedAttemptOutcome =
  | {
      status: "created";
      attemptId: string;
      ownerUserId: string;
    }
  | { status: "blocked"; reason: "attempt_in_progress" };

export type SettleRewardedAttemptOutcome =
  | { status: "earned"; amount: number }
  | { status: "already-earned"; amount: number }
  | { status: "dismissed" };

export interface SettleRewardedAttemptInput {
  attemptId: string;
  expectedOwnerUserId: string;
  outcome: "earned" | "dismissed";
  settledAt?: number;
}

function requireTimestamp(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RewardedAttemptError("REWARDED_ATTEMPT_LEDGER_INVALID");
  }
  return value;
}

function requireCurrentBoundary(generation: string): void {
  if (!isOriginAccountBoundaryGenerationCurrent(generation)) {
    throw new RewardedAttemptError("REWARDED_ATTEMPT_BOUNDARY_CHANGED");
  }
}

async function requireOwner(expectedOwnerUserId?: string): Promise<string> {
  const ownerUserId = await validateSyncOwner(expectedOwnerUserId, "Rewarded ad attempt");
  if (!ownerUserId || (expectedOwnerUserId && ownerUserId !== expectedOwnerUserId)) {
    throw new RewardedAttemptError("REWARDED_ATTEMPT_OWNER_UNAVAILABLE");
  }
  return ownerUserId;
}

function requireWallet(value: unknown): RewardedWorld {
  const parsed = rewardedWorldSchema.safeParse(value);
  if (!parsed.success) {
    throw new RewardedAttemptError("REWARDED_ATTEMPT_WALLET_UNAVAILABLE");
  }
  return parsed.data;
}

function readLedger(value: unknown, ownerUserId: string): RewardedAttemptLedger {
  if (value === undefined) {
    return { schemaVersion: 1, ownerUserId, attempts: [] };
  }
  const parsed = rewardedAttemptLedgerSchema.safeParse(value);
  if (!parsed.success || parsed.data.ownerUserId !== ownerUserId) {
    throw new RewardedAttemptError("REWARDED_ATTEMPT_LEDGER_INVALID");
  }
  return parsed.data;
}

function pruneAttempts(
  attempts: RewardedAttemptLedger["attempts"],
): RewardedAttemptLedger["attempts"] {
  return [...attempts]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_RETAINED_ATTEMPTS);
}

function expireStaleAttempts(
  attempts: RewardedAttemptLedger["attempts"],
  now: number,
): RewardedAttemptLedger["attempts"] {
  return attempts.map((attempt) =>
    attempt.status === "prepared" && now - attempt.createdAt >= ATTEMPT_TTL_MS
      ? { ...attempt, status: "expired" as const, updatedAt: now }
      : attempt,
  );
}

function createAttemptId(): string {
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    throw new RewardedAttemptError("REWARDED_ATTEMPT_ID_UNAVAILABLE");
  }
  return globalThis.crypto.randomUUID();
}

export async function beginRewardedAdAttempt(
  preparedAt = Date.now(),
): Promise<BeginRewardedAttemptOutcome> {
  const now = requireTimestamp(preparedAt);
  const accountBoundaryGeneration = captureOriginAccountBoundaryGeneration();
  const ownerUserId = await requireOwner();
  requireCurrentBoundary(accountBoundaryGeneration);

  return runWithOriginExclusiveLock(ACCOUNT_BOUNDARY_DATA_WRITE_LOCK, async () => {
    await requireOwner(ownerUserId);
    requireCurrentBoundary(accountBoundaryGeneration);

    return db.transaction("rw", db.settings, async () => {
      requireCurrentBoundary(accountBoundaryGeneration);
      requireWallet((await db.settings.get(SK.INNER_WORLD))?.value);

      const stored = await db.settings.get(REWARDED_ATTEMPT_LEDGER_KEY);
      const ledger = readLedger(stored?.value, ownerUserId);
      const attempts = expireStaleAttempts(ledger.attempts, now);
      if (attempts.some((attempt) => attempt.status === "prepared")) {
        if (attempts.some((attempt, index) => attempt !== ledger.attempts[index])) {
          await db.settings.put({
            key: REWARDED_ATTEMPT_LEDGER_KEY,
            value: { ...ledger, attempts: pruneAttempts(attempts) },
          });
        }
        return { status: "blocked", reason: "attempt_in_progress" } as const;
      }

      const attemptId = createAttemptId();
      await db.settings.put({
        key: REWARDED_ATTEMPT_LEDGER_KEY,
        value: rewardedAttemptLedgerSchema.parse({
          ...ledger,
          attempts: pruneAttempts([
            {
              id: attemptId,
              status: "prepared",
              createdAt: now,
              updatedAt: now,
            },
            ...attempts,
          ]),
        }),
      });
      requireCurrentBoundary(accountBoundaryGeneration);

      return { status: "created", attemptId, ownerUserId } as const;
    });
  });
}

function requireExactEarnedTransaction(
  transaction: RewardedTreatTransaction | undefined,
  expectedId: string,
  amount: number,
): void {
  if (
    !transaction ||
    transaction.id !== expectedId ||
    transaction.source !== "ad" ||
    transaction.amount !== amount
  ) {
    throw new RewardedAttemptError("REWARDED_ATTEMPT_WALLET_CONFLICT");
  }
}

export async function settleRewardedAdAttempt(
  input: SettleRewardedAttemptInput,
): Promise<SettleRewardedAttemptOutcome> {
  const settledAt = requireTimestamp(input.settledAt ?? Date.now());
  const parsedAttemptId = z.string().uuid().safeParse(input.attemptId);
  const parsedOwnerId = z.string().uuid().safeParse(input.expectedOwnerUserId);
  if (!parsedAttemptId.success || !parsedOwnerId.success) {
    throw new RewardedAttemptError("REWARDED_ATTEMPT_LEDGER_INVALID");
  }

  const accountBoundaryGeneration = captureOriginAccountBoundaryGeneration();
  const ownerUserId = await requireOwner(input.expectedOwnerUserId);
  requireCurrentBoundary(accountBoundaryGeneration);

  return runWithOriginExclusiveLock(ACCOUNT_BOUNDARY_DATA_WRITE_LOCK, async () => {
    await requireOwner(ownerUserId);
    requireCurrentBoundary(accountBoundaryGeneration);

    return db.transaction("rw", db.settings, async () => {
      const stored = await db.settings.get(REWARDED_ATTEMPT_LEDGER_KEY);
      const ledger = readLedger(stored?.value, ownerUserId);
      const attemptIndex = ledger.attempts.findIndex(
        (attempt) => attempt.id === parsedAttemptId.data,
      );
      if (attemptIndex < 0) {
        throw new RewardedAttemptError("REWARDED_ATTEMPT_NOT_FOUND");
      }

      const attempt = ledger.attempts[attemptIndex];
      const transactionId = `rewarded-ad:${attempt.id}`;
      const rewardAmount = AD_REWARDS.rewardedVideoTreats;

      if (attempt.status === "earned") {
        const world = requireWallet((await db.settings.get(SK.INNER_WORLD))?.value);
        requireExactEarnedTransaction(
          world.treats.transactions.find((transaction) => transaction.id === transactionId),
          transactionId,
          rewardAmount,
        );
        return { status: "already-earned", amount: rewardAmount } as const;
      }
      if (attempt.status !== "prepared") {
        if (attempt.status === "dismissed" && input.outcome === "dismissed") {
          return { status: "dismissed" } as const;
        }
        throw new RewardedAttemptError("REWARDED_ATTEMPT_TERMINAL");
      }
      if (settledAt - attempt.createdAt >= ATTEMPT_TTL_MS) {
        const attempts = [...ledger.attempts];
        attempts[attemptIndex] = { ...attempt, status: "expired", updatedAt: settledAt };
        await db.settings.put({
          key: REWARDED_ATTEMPT_LEDGER_KEY,
          value: { ...ledger, attempts: pruneAttempts(attempts) },
        });
        throw new RewardedAttemptError("REWARDED_ATTEMPT_TERMINAL");
      }

      const attempts = [...ledger.attempts];
      if (input.outcome === "dismissed") {
        attempts[attemptIndex] = { ...attempt, status: "dismissed", updatedAt: settledAt };
        await db.settings.put({
          key: REWARDED_ATTEMPT_LEDGER_KEY,
          value: { ...ledger, attempts: pruneAttempts(attempts) },
        });
        requireCurrentBoundary(accountBoundaryGeneration);
        return { status: "dismissed" } as const;
      }

      const world = requireWallet((await db.settings.get(SK.INNER_WORLD))?.value);
      const existingTransaction = world.treats.transactions.find(
        (transaction) => transaction.id === transactionId,
      );
      if (existingTransaction) {
        requireExactEarnedTransaction(existingTransaction, transactionId, rewardAmount);
      }

      const nextBalance = world.treats.balance + rewardAmount;
      const nextLifetimeEarned = world.treats.lifetimeEarned + rewardAmount;
      if (!Number.isSafeInteger(nextBalance) || !Number.isSafeInteger(nextLifetimeEarned)) {
        throw new RewardedAttemptError("REWARDED_ATTEMPT_AMOUNT_OVERFLOW");
      }

      const transaction: RewardedTreatTransaction = existingTransaction ?? {
        id: transactionId,
        amount: rewardAmount,
        source: "ad",
        timestamp: settledAt,
      };
      const nextWorld: RewardedWorld = existingTransaction
        ? world
        : {
            ...world,
            treats: {
              ...world.treats,
              balance: nextBalance,
              lifetimeEarned: nextLifetimeEarned,
              lastEarnedAt: settledAt,
              transactions: [transaction, ...world.treats.transactions].slice(0, 50),
            },
          };

      attempts[attemptIndex] = {
        ...attempt,
        status: "earned",
        earnedAt: settledAt,
        updatedAt: settledAt,
      };
      await db.settings.bulkPut([
        { key: SK.INNER_WORLD, value: rewardedWorldSchema.parse(nextWorld) },
        {
          key: REWARDED_ATTEMPT_LEDGER_KEY,
          value: rewardedAttemptLedgerSchema.parse({
            ...ledger,
            attempts: pruneAttempts(attempts),
          }),
        },
      ]);
      requireCurrentBoundary(accountBoundaryGeneration);

      return existingTransaction
        ? ({ status: "already-earned", amount: rewardAmount } as const)
        : ({ status: "earned", amount: rewardAmount } as const);
    });
  });
}

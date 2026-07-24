import { afterEach, describe, expect, it, vi } from "vitest";

import {
  consumeStagedJournalMagicLinkConfirmation,
  parseJournalMagicLinkConfirmation,
  stageJournalMagicLinkConfirmation,
  stripJournalMagicLinkSecretsFromUrl,
  subscribeToJournalMagicLinkConfirmations,
} from "@/lib/journalMagicLinkConfirmation";

const TOKEN_HASH = "a".repeat(64);

afterEach(() => {
  consumeStagedJournalMagicLinkConfirmation();
});

describe("journal Magic Link confirmation handoff", () => {
  it("parses a trusted web callback without consuming the one-time token", () => {
    const confirmation = parseJournalMagicLinkConfirmation(
      `https://yehor212.github.io/people-first-app/diary?nav=v2&journalReset=nonce-1#view=diary&zenflowConfirm=1&token_hash=${TOKEN_HASH}&type=email`,
    );

    expect(confirmation).toEqual({
      sourceUrl:
        `https://yehor212.github.io/people-first-app/diary?nav=v2&journalReset=nonce-1#view=diary&zenflowConfirm=1&token_hash=${TOKEN_HASH}&type=email`,
      tokenHash: TOKEN_HASH,
    });
  });

  it("rejects an otherwise well-formed confirmation from an untrusted origin", () => {
    expect(
      parseJournalMagicLinkConfirmation(
        `https://evil.example/diary?journalReset=nonce-1#zenflowConfirm=1&token_hash=${TOKEN_HASH}&type=email`,
      ),
    ).toBeNull();
  });

  it("accepts the exact native callback and rejects lookalike schemes", () => {
    expect(
      parseJournalMagicLinkConfirmation(
        `com.zenflow.app://login-callback?journalReset=nonce-1#zenflowConfirm=1&token_hash=${TOKEN_HASH}&type=email`,
      ),
    ).not.toBeNull();
    expect(
      parseJournalMagicLinkConfirmation(
        `com.zenflow.app.evil://login-callback?journalReset=nonce-1#zenflowConfirm=1&token_hash=${TOKEN_HASH}&type=email`,
      ),
    ).toBeNull();
  });

  it("removes token material while preserving route, reset nonce, and unrelated hash state", () => {
    expect(
      stripJournalMagicLinkSecretsFromUrl(
        `https://yehor212.github.io/people-first-app/diary?nav=v2&journalReset=nonce-1#view=diary&zenflowConfirm=1&token_hash=${TOKEN_HASH}&type=email`,
      ),
    ).toBe("/people-first-app/diary?nav=v2&journalReset=nonce-1#view=diary");
  });

  it("stages native confirmation in memory and emits a token-free signal", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToJournalMagicLinkConfirmations(listener);

    expect(
      stageJournalMagicLinkConfirmation(
        `com.zenflow.app://login-callback?journalReset=nonce-1#zenflowConfirm=1&token_hash=${TOKEN_HASH}&type=email`,
      ),
    ).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(consumeStagedJournalMagicLinkConfirmation()?.tokenHash).toBe(TOKEN_HASH);
    expect(consumeStagedJournalMagicLinkConfirmation()).toBeNull();

    unsubscribe();
  });

  it("rejects malformed and query-string token hashes", () => {
    expect(
      parseJournalMagicLinkConfirmation(
        "com.zenflow.app://login-callback?journalReset=nonce-1&zenflowConfirm=1&token_hash=short&type=email",
      ),
    ).toBeNull();
    expect(
      parseJournalMagicLinkConfirmation(
        `com.zenflow.app://login-callback?journalReset=nonce-1&zenflowConfirm=1&token_hash=${TOKEN_HASH}&type=email`,
      ),
    ).toBeNull();
  });
});

import type { Event, EventHint } from "@sentry/core";

import { isChunkLoadMessage } from "@/lib/chunkErrorDetection";

export const SENTRY_ALLOW_URLS = [
  /^https:\/\/yehor212\.github\.io\/people-first-app\//,
  /^https:\/\/localhost(?::\d+)?\//,
  /^http:\/\/localhost(?::\d+)?\//,
  /^http:\/\/127\.0\.0\.1(?::\d+)?\//,
  /^capacitor:\/\//,
  /^capacitor-electron:\/\//,
] as const;

export const SENTRY_IGNORE_ERRORS = [
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications",
  "Non-Error promise rejection captured",
  "Script error.",
  /^Script error$/,
] as const;

const lockStolenPattern = /lock.*stolen|stolen.*lock/i;

function messageFromOriginalException(error: unknown): string | null {
  try {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    if (error && typeof error === "object" && "message" in error) {
      const message = (error as { message?: unknown }).message;
      return typeof message === "string" ? message : null;
    }
  } catch {
    return null;
  }
  return null;
}

function eventMessages(event: Event, hint?: EventHint): string[] {
  try {
    const messages = [
      messageFromOriginalException(hint?.originalException),
      event.message ?? null,
      ...(event.exception?.values ?? []).map((value) => value.value ?? null),
    ];
    return messages.filter((message): message is string => Boolean(message));
  } catch {
    return [];
  }
}

export function isExpectedAbortError(error: unknown): boolean {
  try {
    if (!error || typeof error !== "object") return false;
    const name = error instanceof Error ? error.name : (error as { name?: unknown }).name;
    const message =
      error instanceof Error ? error.message : (error as { message?: unknown }).message;
    const code = (error as { code?: unknown }).code;
    return (
      name === "AbortError" ||
      code === 20 ||
      (typeof message === "string" &&
        (message.includes("aborted") || message.includes("AbortError")))
    );
  } catch {
    return false;
  }
}

export function shouldDropSentryEvent(event: Event, hint?: EventHint): boolean {
  try {
    const originalException = hint?.originalException;
    if (isExpectedAbortError(originalException)) return true;
    return eventMessages(event, hint).some(
      (message) => isChunkLoadMessage(message) || lockStolenPattern.test(message)
    );
  } catch {
    return false;
  }
}

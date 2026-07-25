export class JournalRemovePasswordLockedError extends Error {
  constructor() {
    super("Unlock your diary before removing password protection.");
    this.name = "JournalRemovePasswordLockedError";
  }
}

export class JournalRemovePasswordPartialError extends Error {
  readonly originalError: unknown;

  constructor(originalError?: unknown) {
    super("Diary password removal stopped after biometric unlock was disabled.");
    this.name = "JournalRemovePasswordPartialError";
    this.originalError = originalError;
  }
}

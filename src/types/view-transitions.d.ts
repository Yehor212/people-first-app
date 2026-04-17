// Ambient declarations for the View Transitions API.
// Not yet in TypeScript's default lib.dom.d.ts (TS 5.x baseline).
// Kept as a declaration-only module — no runtime emission.

interface ViewTransition {
  readonly finished: Promise<void>;
  readonly ready: Promise<void>;
  readonly updateCallbackDone: Promise<void>;
  skipTransition(): void;
}

interface Document {
  startViewTransition?(callback: () => void | Promise<void>): ViewTransition;
}

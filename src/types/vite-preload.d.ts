// Ambient declaration for Vite's `vite:preloadError` event.
// Fires on <link rel="modulepreload"> or dynamic import() load failure.
// Source: vite.dev/guide/build.html#load-error-handling, vitejs/vite#11804.
// Kept as declaration-only — no runtime emission.

interface VitePreloadErrorEvent extends Event {
  readonly payload: Error;
}

interface WindowEventMap {
  "vite:preloadError": VitePreloadErrorEvent;
}

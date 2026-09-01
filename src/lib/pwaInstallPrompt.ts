export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface PwaInstallPromptSnapshot {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstalled: boolean;
}

type SnapshotListener = () => void;
type NavigatorWithStandalone = Navigator & { standalone?: boolean };

const EMPTY_SNAPSHOT: PwaInstallPromptSnapshot = {
  deferredPrompt: null,
  isInstalled: false,
};

let snapshot = EMPTY_SNAPSHOT;
let initialized = false;
let lifecycleListenersAttached = false;
const listeners = new Set<SnapshotListener>();

function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      (window.navigator as NavigatorWithStandalone).standalone === true
    );
  } catch {
    return false;
  }
}

function isBeforeInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  const candidate = event as Partial<BeforeInstallPromptEvent>;
  return (
    typeof candidate.prompt === "function" &&
    Boolean(candidate.userChoice) &&
    typeof (candidate.userChoice as Promise<unknown>).then === "function"
  );
}

function publish(nextSnapshot: PwaInstallPromptSnapshot): void {
  if (
    nextSnapshot.deferredPrompt === snapshot.deferredPrompt &&
    nextSnapshot.isInstalled === snapshot.isInstalled
  ) {
    return;
  }

  snapshot = nextSnapshot;
  listeners.forEach((listener) => listener());
}

function handleBeforeInstallPrompt(event: Event): void {
  if (snapshot.isInstalled || !isBeforeInstallPromptEvent(event)) return;
  event.preventDefault();
  publish({ deferredPrompt: event, isInstalled: false });
}

function handleAppInstalled(): void {
  publish({ deferredPrompt: null, isInstalled: true });
}

/**
 * Starts one page-lifetime listener before lazy settings code loads. Browser
 * install prompt events are single-use and otherwise disappear if no listener
 * exists at dispatch time.
 */
export function initializePwaInstallPromptCapture(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const installed = isStandalonePwa();
  snapshot = { deferredPrompt: null, isInstalled: installed };
  if (installed) return;

  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  window.addEventListener("appinstalled", handleAppInstalled);
  lifecycleListenersAttached = true;
}

export function subscribeToPwaInstallPrompt(listener: SnapshotListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPwaInstallPromptSnapshot(): PwaInstallPromptSnapshot {
  return snapshot;
}

export function getServerPwaInstallPromptSnapshot(): PwaInstallPromptSnapshot {
  return EMPTY_SNAPSHOT;
}

export function consumePwaInstallPrompt(): BeforeInstallPromptEvent | null {
  const prompt = snapshot.deferredPrompt;
  if (prompt) publish({ deferredPrompt: null, isInstalled: snapshot.isInstalled });
  return prompt;
}

export function resetPwaInstallPromptCaptureForTests(): void {
  if (lifecycleListenersAttached && typeof window !== "undefined") {
    window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.removeEventListener("appinstalled", handleAppInstalled);
  }
  lifecycleListenersAttached = false;
  initialized = false;
  snapshot = EMPTY_SNAPSHOT;
  listeners.clear();
}

import React from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { APP_VERSION, getAppMetadata } from "@/lib/appVersion";
import { crashReporting } from "@/lib/crashReporting";
import { captureOrBuffer } from "@/lib/errorBuffer";
import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import { createFocusTrap, announceError } from "@/lib/a11y";
import { logger } from "@/lib/logger";
import { isChunkLoadError } from "@/lib/chunkErrorDetection";
import { forceHardReload } from "@/lib/versionCheck";
import type { Language } from "@/i18n/types";
import { RecoveryOrbit } from "@/components/RecoveryOrbit";

const ROOT_ERROR_LANGUAGES: Language[] = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];

const ROOT_ERROR_COPY: Record<Language, {
  title: string;
  body: string;
  safeTitle?: string;
  safeBody?: string;
  actionHint?: string;
  reloadLabel: string;
}> = {
  en: {
    title: "Something went wrong",
    body: "The app failed to start. Please reload.",
    safeTitle: "Your data is safe",
    safeBody: "Recovery mode paused only this screen. Your recent error was saved locally.",
    actionHint: "Reload usually reconnects the app in a few seconds.",
    reloadLabel: "Reload App",
  },
  uk: {
    title: "Щось пішло не так",
    body: "Не вдалося запустити застосунок. Перезавантажте сторінку.",
    reloadLabel: "Перезавантажити",
  },
  es: {
    title: "Algo salió mal",
    body: "La app no pudo iniciar. Recarga la página.",
    reloadLabel: "Recargar app",
  },
  de: {
    title: "Etwas ist schiefgelaufen",
    body: "Die App konnte nicht gestartet werden. Bitte neu laden.",
    reloadLabel: "App neu laden",
  },
  fr: {
    title: "Une erreur est survenue",
    body: "L'application n'a pas pu démarrer. Veuillez recharger.",
    reloadLabel: "Recharger l'app",
  },
  ja: {
    title: "問題が発生しました",
    body: "アプリを起動できませんでした。再読み込みしてください。",
    reloadLabel: "アプリを再読み込み",
  },
  ar: {
    title: "حدث خطأ ما",
    body: "تعذر بدء التطبيق. يرجى إعادة التحميل.",
    reloadLabel: "إعادة تحميل التطبيق",
  },
  he: {
    title: "משהו השתבש",
    body: "האפליקציה לא הצליחה להתחיל. נא לטעון מחדש.",
    reloadLabel: "טעינת האפליקציה מחדש",
  },
};

function getRootErrorLanguage(): Language {
  const stored = safeLocalStorageGet<Language>(SK.LANGUAGE, "en");
  if (ROOT_ERROR_LANGUAGES.includes(stored)) return stored;

  const browserLanguage =
    typeof navigator !== "undefined" ? navigator.language.split("-")[0] : "en";
  return ROOT_ERROR_LANGUAGES.includes(browserLanguage as Language)
    ? (browserLanguage as Language)
    : "en";
}

const logError = (payload: Record<string, unknown>) => {
  try {
    const metadata = getAppMetadata();
    const enhancedPayload = {
      ...payload,
      appVersion: APP_VERSION,
      dataSchemaVersion: metadata?.dataSchemaVersion || "unknown",
      time: new Date().toISOString(),
    };

    const existing = safeLocalStorageGet<Record<string, unknown>[]>(SK.ERROR_LOG, []);
    const next = [...existing, enhancedPayload].slice(-10); // Keep last 10 errors
    safeLocalStorageSet(SK.ERROR_LOG, next);
  } catch {
    // Ignore storage errors.
  }
};

interface ErrorBoundaryBaseProps {
  onReload: () => void;
  title: string;
  body: string;
  kicker?: string;
  safeTitle: string;
  safeBody: string;
  actionHint: string;
  reloadLabel: string;
  children: React.ReactNode;
}

interface ErrorBoundaryBaseState {
  hasError: boolean;
  error: Error | null;
}

function RecoveryGlyph({ label }: { label?: string }) {
  return <RecoveryOrbit label={label} />;
}

function RecoveryTrustNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto flex w-full max-w-sm items-start gap-3 rounded-3xl border border-[hsl(var(--foreground)/0.10)] bg-[linear-gradient(135deg,hsl(var(--zf-surface-2)/0.76),hsl(var(--zf-night-1)/0.56))] p-3 text-left shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)]">
      <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[hsl(var(--zf-role-body)/0.32)] bg-[hsl(var(--zf-role-body)/0.13)]">
        <span className="h-3 w-3 rounded-full bg-[hsl(var(--zf-role-body))] shadow-[0_0_22px_hsl(var(--zf-role-body)/0.72)]" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[hsl(var(--zf-text-strong))]">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-[hsl(var(--zf-text-soft))]">
          {body}
        </span>
      </span>
    </div>
  );
}

class ErrorBoundaryBase extends React.Component<ErrorBoundaryBaseProps, ErrorBoundaryBaseState> {
  state: ErrorBoundaryBaseState = { hasError: false, error: null };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ error });

    // Log to localStorage
    logError({
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
      time: new Date().toISOString(),
    });

    // Report to Crashlytics (native) or console (web)
    crashReporting.recordError(error, {
      componentStack: info.componentStack || "unknown",
      location: window.location.origin + window.location.pathname,
    });

    // Send to Sentry for error monitoring
    captureOrBuffer(error, {
      componentStack: info.componentStack || "unknown",
      location: window.location.origin + window.location.pathname,
      context: "ErrorBoundary",
    });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Desktop: inline error panel instead of full-screen takeover
    const tier = document.documentElement.dataset.deviceTier;
    const isDesktop = tier === "laptop" || tier === "desktop";
    const kicker = this.props.kicker ?? "ZenFlow recovery mode";
    const safeTitle = this.props.safeTitle || "Your data is safe";
    const safeBody =
      this.props.safeBody ||
      "Recovery mode paused only this screen. Your recent error was saved locally.";
    const actionHint =
      this.props.actionHint || "Reload usually reconnects the app in a few seconds.";

    if (isDesktop) {
      return (
        <div className="zf-recovery-shell m-4 rounded-[34px] border border-[hsl(var(--foreground)/0.12)] bg-[radial-gradient(circle_at_20%_0%,hsl(var(--zf-role-focus)/0.18),transparent_32%),linear-gradient(145deg,hsl(var(--zf-night-0)/0.98),hsl(var(--zf-surface-1)/0.92))] p-6 shadow-[0_30px_110px_-70px_hsl(var(--zf-role-focus)/0.86)]">
          <div
            className="mx-auto flex max-w-md flex-col items-center gap-4 text-center"
            data-testid="error-boundary-card"
          >
            <RecoveryGlyph label={kicker} />
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--zf-role-focus))]">
              {kicker}
            </p>
            <h2 className="font-display text-2xl font-semibold text-[hsl(var(--zf-text-strong))]">
              {this.props.title}
            </h2>
            <p className="max-w-sm text-sm leading-relaxed text-[hsl(var(--zf-text-soft))]">
              {this.props.body}
            </p>
            <RecoveryTrustNote title={safeTitle} body={safeBody} />
            <p className="max-w-sm text-xs font-medium leading-relaxed text-[hsl(var(--zf-text-muted))]">
              {actionHint}
            </p>
            <div className="w-full max-w-sm">
              <button
                onClick={this.props.onReload}
                className="zf-recovery-primary min-h-[48px] w-full rounded-2xl bg-[linear-gradient(135deg,hsl(var(--zf-role-body)),hsl(var(--zf-role-focus)))] px-4 py-2 text-sm font-semibold text-[hsl(var(--zf-night-0))] shadow-[0_18px_42px_-28px_hsl(var(--zf-role-focus)/0.90)] hover:opacity-90 motion-safe:transition-opacity"
              >
                {this.props.reloadLabel}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="zf-recovery-stage flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_18%_16%,hsl(var(--zf-role-focus)/0.18),transparent_34%),radial-gradient(circle_at_82%_8%,hsl(var(--zf-role-mind)/0.16),transparent_30%),linear-gradient(150deg,hsl(var(--zf-night-0)),hsl(var(--zf-night-1)))] px-4 py-10">
        <div
          className="zf-recovery-card relative w-full max-w-md overflow-hidden rounded-[34px] border border-[hsl(var(--foreground)/0.12)] bg-[linear-gradient(145deg,hsl(var(--zf-surface-1)/0.94),hsl(var(--zf-night-0)/0.96))] p-6 text-center shadow-[0_34px_100px_-70px_hsl(var(--zf-role-focus)/0.82)] before:pointer-events-none before:absolute before:inset-x-10 before:top-0 before:h-[3px] before:rounded-b-full before:bg-[linear-gradient(90deg,hsl(var(--zf-role-body)),hsl(var(--zf-role-focus)),hsl(var(--zf-role-mind)))]"
          data-testid="error-boundary-card"
        >
          <div className="relative z-[1] space-y-4">
            <div className="flex justify-center">
              <RecoveryGlyph label={kicker} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--zf-role-focus))]">
              {kicker}
            </p>
            <h2 className="font-display text-2xl font-semibold text-[hsl(var(--zf-text-strong))]">
              {this.props.title}
            </h2>
            <p className="text-sm leading-relaxed text-[hsl(var(--zf-text-soft))]">
              {this.props.body}
            </p>
            <RecoveryTrustNote title={safeTitle} body={safeBody} />
            <p className="mx-auto max-w-xs text-xs font-medium leading-relaxed text-[hsl(var(--zf-text-muted))]">
              {actionHint}
            </p>
            <div>
              <button
                onClick={this.props.onReload}
                className="zf-recovery-primary min-h-[48px] w-full rounded-2xl bg-[linear-gradient(135deg,hsl(var(--zf-role-body)),hsl(var(--zf-role-focus)))] py-3 font-semibold text-[hsl(var(--zf-night-0))] shadow-[0_18px_42px_-28px_hsl(var(--zf-role-focus)/0.90)] hover:opacity-90 motion-safe:transition-opacity"
              >
                {this.props.reloadLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useLanguage();
  return (
    <ErrorBoundaryBase
      title={t?.errorBoundaryTitle ?? "Something went wrong"}
      body={t?.errorBoundaryBody ?? "An unexpected error occurred. Please reload the app."}
      kicker={t?.errorBoundaryKicker ?? "ZenFlow recovery mode"}
      safeTitle={t?.errorBoundarySafeTitle ?? "Your data is safe"}
      safeBody={
        t?.errorBoundarySafeBody ??
        "Recovery mode paused only this screen. Your recent error was saved locally."
      }
      actionHint={
        t?.errorBoundaryActionHint ?? "Reload usually reconnects the app in a few seconds."
      }
      reloadLabel={t?.errorBoundaryReload ?? "Reload App"}
      onReload={() => window.location.reload()}
    >
      {children}
    </ErrorBoundaryBase>
  );
};

/**
 * RootErrorBoundary — context-free outermost safety net.
 *
 * Catches crashes in providers themselves (LanguageProvider, QueryClientProvider,
 * etc.) that the inner `ErrorBoundary` cannot — because that boundary sits
 * INSIDE those providers and uses `useLanguage()`. When a provider throws during
 * render, the inner boundary never mounts.
 *
 * Uses a tiny synchronous translation map (no hook calls). Error telemetry still
 * flows to Sentry/Crashlytics via `componentDidCatch` in the shared base class.
 * Inner `ErrorBoundary` remains in place for localized app-level errors.
 * Source: react.dev/reference/react/Component#componentdidcatch "error-boundaries
 * should be positioned above the providers they protect".
 */
export const RootErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const copy = ROOT_ERROR_COPY[getRootErrorLanguage()];

  return (
    <ErrorBoundaryBase
      title={copy.title}
      body={copy.body}
      safeTitle={copy.safeTitle ?? "Your data is safe"}
      safeBody={
        copy.safeBody ??
        "Recovery mode paused only this screen. Your recent error was saved locally."
      }
      actionHint={copy.actionHint ?? "Reload usually reconnects the app in a few seconds."}
      reloadLabel={copy.reloadLabel}
      onReload={() => window.location.reload()}
    >
      {children}
    </ErrorBoundaryBase>
  );
};

/**
 * ModalErrorBoundary - Error boundary for modals and lazy-loaded components.
 * Shows a contained error state instead of crashing the entire app.
 * Use this to wrap any Suspense boundaries or modal content.
 * Chunk-error detection delegated to `@/lib/chunkErrorDetection` (single
 * source of truth shared with UpdateRequiredDialog + main.tsx handlers).
 */
interface ModalErrorBoundaryProps {
  children: React.ReactNode;
  onClose?: () => void;
  fallbackTitle?: string;
  fallbackBody?: string;
  tryAgainLabel?: string;
  closeLabel?: string;
}

interface ModalErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ModalErrorBoundaryClass extends React.Component<
  ModalErrorBoundaryProps,
  ModalErrorBoundaryState
> {
  state: ModalErrorBoundaryState = { hasError: false, error: null };

  // Refs for focus trap and container
  private containerRef = React.createRef<HTMLDivElement>();
  private deactivateFocusTrap: (() => void) | null = null;

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to localStorage
    logError({
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
      context: "modal",
      time: new Date().toISOString(),
    });

    // Report to Crashlytics
    crashReporting.recordError(error, {
      componentStack: info.componentStack || "unknown",
      location: window.location.origin + window.location.pathname,
      context: "modal",
    });

    // Send to Sentry for error monitoring
    captureOrBuffer(error, {
      componentStack: info.componentStack || "unknown",
      location: window.location.origin + window.location.pathname,
      context: "ModalErrorBoundary",
    });

    // Auto-reload on chunk load errors (stale assets after deployment)
    if (isChunkLoadError(error)) {
      const reloadKey = "zenflow_chunk_reload_boundary";
      const lastReload = sessionStorage.getItem(reloadKey);
      if (!lastReload || Date.now() - parseInt(lastReload) > 60000) {
        sessionStorage.setItem(reloadKey, Date.now().toString());
        logger.log("[ModalErrorBoundary] Chunk error detected, hard-reloading...");
        void forceHardReload().catch((reloadError) => {
          logger.warn("[ErrorBoundary] Hard reload failed, falling back to normal reload:", reloadError);
          window.location.reload();
        });
        return;
      }
    }

    // Announce error to screen readers
    const title = this.props.fallbackTitle || "Something went wrong";
    announceError(title);
  }

  componentDidUpdate(_prevProps: ModalErrorBoundaryProps, prevState: ModalErrorBoundaryState) {
    // Activate focus trap when error appears
    if (this.state.hasError && !prevState.hasError && this.containerRef.current) {
      this.deactivateFocusTrap = createFocusTrap(this.containerRef.current, {
        autoFocus: true,
      });
    }
  }

  componentWillUnmount() {
    // Cleanup focus trap
    this.deactivateFocusTrap?.();
  }

  handleRetry = () => {
    const error = this.state.error;

    if (isChunkLoadError(error)) {
      // Force hard reload to get fresh assets outside stale PWA caches.
      logger.log("[ErrorBoundary] Chunk error detected, hard-reloading page...");
      void forceHardReload().catch((reloadError) => {
        logger.warn("[ErrorBoundary] Hard reload failed, falling back to normal reload:", reloadError);
        window.location.reload();
      });
      return;
    }

    // Deactivate focus trap before resetting state
    this.deactivateFocusTrap?.();
    this.deactivateFocusTrap = null;
    this.setState({ hasError: false, error: null });
  };

  handleClose = () => {
    // Deactivate focus trap before closing
    this.deactivateFocusTrap?.();
    this.deactivateFocusTrap = null;
    this.setState({ hasError: false, error: null });
    this.props.onClose?.();
  };

  // Handle Escape key to close error dialog
  handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape" && this.props.onClose) {
      event.preventDefault();
      this.handleClose();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const title = this.props.fallbackTitle || "Something went wrong";
    const body =
      this.props.fallbackBody || "This feature encountered an error. Try closing and reopening.";

    return (
      <div
        ref={this.containerRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="error-boundary-title"
        aria-describedby="error-boundary-desc"
        tabIndex={-1}
        onKeyDown={this.handleKeyDown}
        className="flex flex-col items-center justify-center p-6 text-center min-h-[200px]"
      >
        <div className="w-16 h-16 mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h3 id="error-boundary-title" className="text-lg font-semibold text-foreground mb-2">
          {title}
        </h3>
        <p id="error-boundary-desc" className="text-sm text-muted-foreground mb-4 max-w-xs">
          {body}
        </p>
        <div className="flex gap-3">
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-xl text-sm font-medium hover:bg-muted motion-safe:transition-colors"
          >
            {this.props.tryAgainLabel || "Try Again"}
          </button>
          {this.props.onClose && (
            <button
              onClick={this.handleClose}
              className="px-4 py-2 zen-gradient text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 motion-safe:transition-opacity"
            >
              {this.props.closeLabel || "Close"}
            </button>
          )}
        </div>
      </div>
    );
  }
}

export const ModalErrorBoundary: React.FC<ModalErrorBoundaryProps> = (props) => {
  const { t } = useLanguage();
  return (
    <ModalErrorBoundaryClass
      {...props}
      fallbackTitle={props.fallbackTitle || t?.modalErrorTitle || "Something went wrong"}
      fallbackBody={props.fallbackBody || t?.modalErrorBody || "This feature encountered an error."}
      tryAgainLabel={props.tryAgainLabel || t?.tryAgain || "Try Again"}
      closeLabel={props.closeLabel || t?.close || "Close"}
    />
  );
};

/**
 * LazyErrorBoundary - Error boundary specifically for lazy-loaded components.
 * Provides a minimal error state that doesn't disrupt the UI flow.
 */
export const LazyErrorBoundary: React.FC<{
  children: React.ReactNode;
  componentName?: string;
}> = ({ children, componentName = "component" }) => {
  const { t } = useLanguage();
  return (
    <ModalErrorBoundaryClass
      fallbackTitle={`${t?.failedToLoad || "Failed to load"} ${componentName}`}
      fallbackBody={t?.failedToLoadBody || "Please try again or reload the app."}
      tryAgainLabel={t?.tryAgain || "Try Again"}
      closeLabel={t?.close || "Close"}
    >
      {children}
    </ModalErrorBoundaryClass>
  );
};

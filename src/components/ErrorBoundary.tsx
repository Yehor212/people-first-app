import React from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { APP_VERSION, getAppMetadata } from "@/lib/appVersion";
import { crashReporting } from "@/lib/crashReporting";
import { safeLocalStorageGet } from "@/lib/safeJson";
import { captureError } from "@/lib/sentry";
import { createFocusTrap, announceError } from "@/lib/a11y";
import { logger } from "@/lib/logger";

const LOG_KEY = "zenflow-error-log";

const logError = (payload: Record<string, unknown>) => {
  try {
    const metadata = getAppMetadata();
    const enhancedPayload = {
      ...payload,
      appVersion: APP_VERSION,
      dataSchemaVersion: metadata?.dataSchemaVersion || 'unknown',
      time: new Date().toISOString()
    };

    const existing = safeLocalStorageGet<Record<string, unknown>[]>(LOG_KEY, []);
    const next = [...existing, enhancedPayload].slice(-10); // Keep last 10 errors
    localStorage.setItem(LOG_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors.
  }
};

const exportDebugReport = (error?: Error | null) => {
  const metadata = getAppMetadata();

  const report = {
    version: APP_VERSION,
    dataSchemaVersion: metadata?.dataSchemaVersion || 'unknown',
    updateCount: metadata?.updateCount || 0,
    lastUpdateDate: metadata?.lastUpdateDate || 'unknown',
    timestamp: new Date().toISOString(),
    location: window.location.href,
    userAgent: navigator.userAgent,
    error: error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : null,
    // Add browser storage info
    storageInfo: {
      localStorageAvailable: typeof localStorage !== 'undefined',
      indexedDBAvailable: typeof indexedDB !== 'undefined',
    },
    // Add last 10 errors from log
    recentErrors: safeLocalStorageGet<Record<string, unknown>[]>(LOG_KEY, [])
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `zenflow-debug-report-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

interface ErrorBoundaryBaseProps {
  onExport: (error: Error | null) => void;
  onReload: () => void;
  title: string;
  body: string;
  exportLabel: string;
  reloadLabel: string;
  children: React.ReactNode;
}

interface ErrorBoundaryBaseState {
  hasError: boolean;
  error: Error | null;
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
      time: new Date().toISOString()
    });

    // Report to Crashlytics (native) or console (web)
    crashReporting.recordError(error, {
      componentStack: info.componentStack || 'unknown',
      location: window.location.href
    });

    // Send to Sentry for error monitoring
    captureError(error, {
      componentStack: info.componentStack || 'unknown',
      location: window.location.href,
      context: 'ErrorBoundary'
    });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen zen-gradient-hero flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-card rounded-3xl p-6 zen-shadow-card space-y-4 text-center">
          <h2 className="text-2xl font-bold text-foreground">{this.props.title}</h2>
          <p className="text-sm text-muted-foreground">{this.props.body}</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => this.props.onExport(this.state.error)}
              className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-semibold hover:bg-muted transition-colors"
            >
              {this.props.exportLabel}
            </button>
            <button
              onClick={this.props.onReload}
              className="w-full py-3 zen-gradient text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-opacity"
            >
              {this.props.reloadLabel}
            </button>
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
      title={t?.errorBoundaryTitle ?? 'Something went wrong'}
      body={t?.errorBoundaryBody ?? 'An unexpected error occurred. Please reload the app.'}
      exportLabel={t?.errorBoundaryExport ?? 'Export Debug Report'}
      reloadLabel={t?.errorBoundaryReload ?? 'Reload App'}
      onExport={(error) => exportDebugReport(error)}
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

class ModalErrorBoundaryClass extends React.Component<ModalErrorBoundaryProps, ModalErrorBoundaryState> {
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
      context: 'modal',
      time: new Date().toISOString()
    });

    // Report to Crashlytics
    crashReporting.recordError(error, {
      componentStack: info.componentStack || 'unknown',
      location: window.location.href,
      context: 'modal'
    });

    // Send to Sentry for error monitoring
    captureError(error, {
      componentStack: info.componentStack || 'unknown',
      location: window.location.href,
      context: 'ModalErrorBoundary'
    });

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

    // Check if this was a chunk loading error (stale assets after deployment)
    const isChunkError = error?.message &&
      (error.message.includes('Failed to fetch dynamically imported module') ||
       error.message.includes('Loading chunk') ||
       error.message.includes('Loading CSS chunk'));

    if (isChunkError) {
      // Force reload to get fresh assets
      logger.log('[ErrorBoundary] Chunk error detected, reloading page...');
      window.location.reload();
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
    if (event.key === 'Escape' && this.props.onClose) {
      event.preventDefault();
      this.handleClose();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const title = this.props.fallbackTitle || "Something went wrong";
    const body = this.props.fallbackBody || "This feature encountered an error. Try closing and reopening.";

    return (
      // Add ref, role, aria-modal, and keyboard handler for a11y
      <div
        ref={this.containerRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="error-boundary-title"
        aria-describedby="error-boundary-desc"
        onKeyDown={this.handleKeyDown}
        className="flex flex-col items-center justify-center p-6 text-center min-h-[200px]"
      >
        <div className="w-16 h-16 mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 id="error-boundary-title" className="text-lg font-semibold text-foreground mb-2">{title}</h3>
        <p id="error-boundary-desc" className="text-sm text-muted-foreground mb-4 max-w-xs">{body}</p>
        <div className="flex gap-3">
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-xl text-sm font-medium hover:bg-muted transition-colors"
          >
            {this.props.tryAgainLabel || 'Try Again'}
          </button>
          {this.props.onClose && (
            <button
              onClick={this.handleClose}
              className="px-4 py-2 zen-gradient text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {this.props.closeLabel || 'Close'}
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
      fallbackTitle={props.fallbackTitle || t?.modalErrorTitle || 'Something went wrong'}
      fallbackBody={props.fallbackBody || t?.modalErrorBody || 'This feature encountered an error.'}
      tryAgainLabel={props.tryAgainLabel || t?.tryAgain || 'Try Again'}
      closeLabel={props.closeLabel || t?.close || 'Close'}
    />
  );
};

/**
 * LazyErrorBoundary - Error boundary specifically for lazy-loaded components.
 * Provides a minimal error state that doesn't disrupt the UI flow.
 */
export const LazyErrorBoundary: React.FC<{ children: React.ReactNode; componentName?: string }> = ({
  children,
  componentName = 'component'
}) => {
  const { t } = useLanguage();
  return (
    <ModalErrorBoundaryClass
      fallbackTitle={`${t?.failedToLoad || 'Failed to load'} ${componentName}`}
      fallbackBody={t?.failedToLoadBody || 'Please try again or reload the app.'}
      tryAgainLabel={t?.tryAgain || 'Try Again'}
      closeLabel={t?.close || 'Close'}
    >
      {children}
    </ModalErrorBoundaryClass>
  );
};

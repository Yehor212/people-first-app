import React from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { APP_VERSION, getAppMetadata } from "@/lib/appVersion";
import { crashReporting } from "@/lib/crashReporting";
import { safeLocalStorageGet } from "@/lib/safeJson";

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
      title={t.errorBoundaryTitle}
      body={t.errorBoundaryBody}
      exportLabel={t.errorBoundaryExport}
      reloadLabel={t.errorBoundaryReload}
      onExport={(error) => exportDebugReport(error)}
      onReload={() => window.location.reload()}
    >
      {children}
    </ErrorBoundaryBase>
  );
};

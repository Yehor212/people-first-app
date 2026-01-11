import React from "react";
import { useLanguage } from "@/contexts/LanguageContext";

const LOG_KEY = "zenflow-error-log";

const logError = (payload: Record<string, unknown>) => {
  try {
    const existing = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
    const next = [...existing, payload].slice(-5);
    localStorage.setItem(LOG_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors.
  }
};

const exportDebugReport = (error?: Error | null) => {
  const report = {
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    location: window.location.href,
    userAgent: navigator.userAgent,
    error: error ? { message: error.message, stack: error.stack } : null
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "zenflow-debug-report.json";
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
    logError({
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
      time: new Date().toISOString()
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

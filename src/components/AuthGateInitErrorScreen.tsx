import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { logger } from "@/lib/logger";
import { reloadAppSafely } from "@/lib/versionCheck";

/**
 * Gate screen shown when app initialization fails. Owns the reload attempt
 * state so the parent gate component stays a pure orchestrator.
 */
export function AuthGateInitErrorScreen({ message }: { message: string }) {
  const { t } = useLanguage();
  const [reloadPending, setReloadPending] = useState(false);
  const [reloadError, setReloadError] = useState<string | null>(null);

  return (
    <div className="flex items-center justify-center min-h-screen zen-gradient-hero p-4">
      <div className="max-w-md bg-card rounded-3xl p-6 zen-shadow-card space-y-4">
        <h2 className="text-2xl font-bold text-destructive">{t.initializationError}</h2>
        <p className="text-muted-foreground">{message}</p>
        <button
          onClick={async () => {
            if (reloadPending) return;
            setReloadPending(true);
            setReloadError(null);
            try {
              await reloadAppSafely();
            } catch (error) {
              logger.warn("[AuthGate] Reload blocked until durable state is saved:", error);
              setReloadError(
                t.updateRequiredRefreshFailed ||
                  "Your latest changes could not be confirmed as saved. Try again."
              );
            } finally {
              setReloadPending(false);
            }
          }}
          disabled={reloadPending}
          aria-busy={reloadPending}
          className="w-full py-3 zen-gradient text-primary-foreground rounded-xl font-semibold hover:opacity-90 motion-safe:transition-opacity"
        >
          {t.tryAgain || "Try Again"}
        </button>
        {reloadError ? (
          <p role="alert" aria-label={reloadError} className="text-sm text-destructive">
            {reloadError}
          </p>
        ) : null}
      </div>
    </div>
  );
}

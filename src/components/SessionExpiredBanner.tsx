/**
 * SessionExpiredBanner — Shows when user was previously authenticated
 * but the Supabase session has expired. Non-blocking, dismissible per session.
 */

import { useState } from "react";
import { CloudOff, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface SessionExpiredBannerProps {
  onSignIn: () => void;
}

export function SessionExpiredBanner({ onSignIn }: SessionExpiredBannerProps) {
  const { t } = useLanguage();
  const [dismissed, _setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="mb-3 motion-safe:animate-fade-in">
      <button
        onClick={onSignIn}
        className="w-full flex items-center gap-3 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-start motion-safe:transition-colors hover:bg-amber-500/15 active:scale-[0.99]"
      >
        <div className="p-2 bg-amber-500/20 rounded-xl flex-shrink-0">
          <CloudOff className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {t.sessionExpired || "Cloud sync paused"}
          </p>
          <p className="text-xs text-muted-foreground">
            {t.sessionExpiredMessage || "Sign in to sync your data"}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 rtl:scale-x-[-1]" aria-hidden="true" />
      </button>
    </div>
  );
}

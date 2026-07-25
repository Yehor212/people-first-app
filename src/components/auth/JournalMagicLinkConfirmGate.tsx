import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Loader2, MailCheck } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { useBackHandler } from "@/hooks/useBackHandler";
import { createFocusTrap } from "@/lib/a11y";
import { notifyAuthComplete } from "@/lib/authRedirect";
import { cancelPkceAttemptFromUrl } from "@/lib/authTransitionCoordinator";
import {
  consumeStagedJournalMagicLinkConfirmation,
  parseJournalMagicLinkConfirmation,
  stripJournalMagicLinkSecretsFromUrl,
  subscribeToJournalMagicLinkConfirmations,
  type JournalMagicLinkConfirmation,
} from "@/lib/journalMagicLinkConfirmation";
import {
  clearJournalPasswordResetParamFromCurrentUrl,
  persistJournalPasswordResetProofFromUrl,
} from "@/lib/journalPasswordResetHandoff";
import { logger } from "@/lib/logger";
import { stripPkceAttemptFromUrl } from "@/lib/pkceAttemptStorage";
import { supabase } from "@/lib/supabaseClient";

interface JournalMagicLinkConfirmGateProps {
  children: ReactNode;
}

function getInitialConfirmation(): JournalMagicLinkConfirmation | null {
  if (typeof window === "undefined") return null;
  return (
    parseJournalMagicLinkConfirmation(window.location.href) ||
    consumeStagedJournalMagicLinkConfirmation()
  );
}

export function JournalMagicLinkConfirmGate({
  children,
}: JournalMagicLinkConfirmGateProps) {
  const { t } = useLanguage();
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const [confirmation, setConfirmation] = useState(getInitialConfirmation);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return subscribeToJournalMagicLinkConfirmations(() => {
      const staged = consumeStagedJournalMagicLinkConfirmation();
      if (staged) {
        setError("");
        setConfirmation(staged);
      }
    });
  }, []);

  useEffect(() => {
    if (!confirmation || typeof window === "undefined") return;
    const current = parseJournalMagicLinkConfirmation(window.location.href);
    if (!current) return;

    const cleanUrl = stripPkceAttemptFromUrl(
      stripJournalMagicLinkSecretsFromUrl(window.location.href),
    );
    window.history.replaceState(window.history.state, "", cleanUrl);
  }, [confirmation]);

  useEffect(() => {
    if (!confirmation || !dialogRef.current) return undefined;
    return createFocusTrap(dialogRef.current, {
      initialFocus: cancelRef.current,
    });
  }, [confirmation]);

  const handleCancel = () => {
    if (isPending) return;
    if (supabase && confirmation) {
      void cancelPkceAttemptFromUrl(supabase.auth, confirmation.sourceUrl).catch((cancelError) => {
        logger.warn("[Auth] Email-link attempt cleanup failed", {
          errorName: cancelError instanceof Error ? cancelError.name : "UnknownError",
        });
      });
    }
    clearJournalPasswordResetParamFromCurrentUrl();
    setError("");
    setConfirmation(null);
  };

  useBackHandler(Boolean(confirmation) && !isPending, handleCancel);

  const handleConfirm = async () => {
    if (!confirmation || isPending) return;
    setIsPending(true);
    setError("");

    try {
      if (!supabase) throw new Error("Supabase unavailable");

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: confirmation.tokenHash,
        type: "email",
      });
      const userId = data.session?.user?.id?.trim() || "";
      if (verifyError || !userId) throw new Error("Magic Link verification failed");

      persistJournalPasswordResetProofFromUrl(confirmation.sourceUrl, userId);
      try {
        await cancelPkceAttemptFromUrl(supabase.auth, confirmation.sourceUrl);
      } catch (cancelError) {
        logger.warn("[Auth] Confirmed email-link attempt cleanup failed", {
          errorName: cancelError instanceof Error ? cancelError.name : "UnknownError",
        });
      }
      notifyAuthComplete();
      setConfirmation(null);
    } catch {
      logger.warn("[Auth] Explicit email-link confirmation failed");
      setError(
        t.journalMagicConfirmError ||
          "This email link could not be confirmed. Request a new link from your diary.",
      );
    } finally {
      setIsPending(false);
    }
  };

  if (!confirmation) return <>{children}</>;

  return (
    <main className="v2-fullscreen-page relative z-[90] flex min-h-[var(--app-viewport-height)] w-full items-center justify-center bg-background px-4 pb-[max(1rem,var(--safe-bottom))] pt-[max(1rem,var(--safe-top))]">
      <div className="absolute inset-0 bg-background/90" aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={isPending}
        tabIndex={-1}
        className="relative z-[91] w-full max-w-md rounded-2xl border border-border/50 bg-card p-5 text-card-foreground shadow-xl sm:p-6"
      >
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailCheck className="h-6 w-6" aria-hidden="true" />
          </div>
        </div>
        <h1 id={titleId} className="mb-2 text-center text-lg font-semibold text-foreground">
          {t.journalMagicConfirmTitle || "Confirm email link"}
        </h1>
        <p
          id={descriptionId}
          className="mb-5 text-center text-sm leading-6 text-muted-foreground"
        >
          {t.journalMagicConfirmDescription ||
            "Continue only if you requested this email for your diary."}
        </p>
        {error ? (
          <p role="alert" className="mb-4 text-center text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            ref={cancelRef}
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="min-h-[44px] w-full rounded-xl bg-muted px-4 py-2.5 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.cancel || "Cancel"}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
            ) : null}
            {isPending
              ? t.journalMagicConfirmPending || "Confirming..."
              : t.journalMagicConfirmAction || "Confirm in ZenFlow"}
          </button>
        </div>
      </div>
    </main>
  );
}

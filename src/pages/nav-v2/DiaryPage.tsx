import { memo, Suspense, useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Bloom } from "@/lib/motion";
import { staggerDelay } from "@/lib/motion/choreography";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { useLanguage } from "@/contexts/LanguageContext";
import type { JournalEntryPrefill, JournalEntrySuggestion } from "@/features/journal";
import { useDiaryDraftStore } from "@/stores/diaryDraftStore";
import type { MoodType } from "@/types";

const JournalModule = lazyWithRetry(
  () => import("@/features/journal/JournalModule").then((m) => ({ default: m.JournalModule })),
  "V2DiaryJournalModule",
);

function valenceToMood(v: number): MoodType {
  if (v < -0.75) return "terrible";
  if (v < -0.25) return "bad";
  if (v < 0.25) return "okay";
  if (v < 0.75) return "good";
  return "great";
}

function capitalizeFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function buildInitialPrefill(
  pendingMoodContext: ReturnType<typeof useDiaryDraftStore.getState>["pendingMoodContext"],
  tx: Record<string, string>,
): JournalEntryPrefill | null {
  if (!pendingMoodContext) return null;

  const prompt =
    pendingMoodContext.scope === "day"
      ? tx.reflectionEvening || tx.journalPrompt7 || tx.howAreYouFeeling || "How are you feeling?"
      : pendingMoodContext.scope === "specific"
        ? tx.journalPrompt4 || tx.journalPrompt6 || tx.howAreYouFeeling || "How are you feeling?"
        : tx.journalPrompt6 || tx.howAreYouFeeling || "How are you feeling?";
  const contextLabel =
    pendingMoodContext.scope === "specific"
      ? pendingMoodContext.specificTime
        ? `${tx.orbScopeSpecific || "At a specific time"} - ${pendingMoodContext.specificTime}`
        : tx.orbScopeSpecific || "At a specific time"
      : pendingMoodContext.scope === "day"
        ? tx.orbScopeDay || "For the whole day"
        : "";

  const emotion = pendingMoodContext.emotion?.trim() || "";
  const contentParts = [
    contextLabel ? `<p><strong>${escapeHtml(contextLabel)}</strong></p>` : "",
    prompt ? `<p>${escapeHtml(prompt)}</p>` : "",
  ].filter(Boolean);

  return {
    title: emotion ? capitalizeFirst(emotion) : "",
    content: contentParts.join(""),
    mood: valenceToMood(pendingMoodContext.valence),
    tags: emotion ? [emotion] : [],
  };
}

function buildInitialSuggestion(
  pendingMoodContext: ReturnType<typeof useDiaryDraftStore.getState>["pendingMoodContext"],
  tx: Record<string, string>,
): JournalEntrySuggestion | null {
  const prefill = buildInitialPrefill(pendingMoodContext, tx);
  if (!pendingMoodContext || !prefill) return null;

  return {
    source: "orb",
    emotion: pendingMoodContext.emotion,
    mood: valenceToMood(pendingMoodContext.valence),
    scope: pendingMoodContext.scope,
    specificTime: pendingMoodContext.specificTime,
    committedAt: pendingMoodContext.committedAt,
    prefill,
  };
}

/**
 * DiaryPage — V2 adapter around the mature V1 personal-diary experience.
 *
 * This intentionally reuses the journal feature module instead of leaving V2
 * as a placeholder. Diary stays history-first like V1, while Orb handoff is
 * exposed as a soft suggestion instead of force-opening the editor.
 */
export const DiaryPage = memo(function DiaryPage() {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const pendingMoodContext = useDiaryDraftStore((s) => s.pendingMoodContext);
  const consumePendingMoodContext = useDiaryDraftStore(
    (s) => s.consumePendingMoodContext,
  );

  useEffect(() => {
    h1Ref.current?.focus();
  }, []);

  const initialEntrySuggestion = useMemo(
    () => buildInitialSuggestion(pendingMoodContext, tx),
    [pendingMoodContext, tx],
  );

  return (
    <Bloom key="diary-page" transition={staggerDelay("primary")}>
      <main
        id="main-content-v2"
        role="main"
        tabIndex={-1}
        className="relative min-h-screen outline-none"
        aria-labelledby="diary-page-heading"
        data-testid="diary-page"
      >
        <h1
          ref={h1Ref}
          id="diary-page-heading"
          tabIndex={-1}
          className="sr-only"
        >
          {tx.navV2Diary || t.diary || "Diary"}
        </h1>

        <Suspense
          fallback={
            <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
              <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card/70 px-4 py-3 text-sm text-muted-foreground backdrop-blur-md">
                <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                <span>{tx.loading || "Loading..."}</span>
              </div>
            </div>
          }
        >
          <JournalModule
            startOpen
            disableCardShell
            hideCloseButton
            presentation="page"
            initialEntrySuggestion={initialEntrySuggestion}
            onInitialEntrySuggestionConsumed={consumePendingMoodContext}
          />
        </Suspense>
      </main>
    </Bloom>
  );
});

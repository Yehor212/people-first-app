import { lazy, memo, startTransition, Suspense, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { SplashScreen } from "@/components/SplashScreen";
import { useThemeStore } from "@/stores/themeStore";
import type { JournalEntryPrefill, JournalEntrySuggestion } from "@/features/journal";
import { useDiaryDraftStore } from "@/stores/diaryDraftStore";
import { formatDate } from "@/lib/utils";
import { getAppAudioAssetSrc } from "@/lib/appAudioAssets";
import type { GratitudeEntry, MoodType } from "@/types";

const JournalModule = lazy(
  () => import("@/features/journal/JournalModule").then((m) => ({ default: m.JournalModule })),
);

const DIARY_AMBIENCE_AUDIO_SRC = getAppAudioAssetSrc("diary-reflection-loop");

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
  emotionLabel: string,
): JournalEntryPrefill | null {
  if (!pendingMoodContext) return null;

  const committedDate = new Date(pendingMoodContext.committedAt);
  const emotion = pendingMoodContext.emotion?.trim() || "";
  const note = pendingMoodContext.note?.trim() || "";

  return {
    title: emotionLabel || (emotion ? capitalizeFirst(emotion) : ""),
    content: note ? `<p>${escapeHtml(note)}</p>` : "",
    mood: pendingMoodContext.mood || valenceToMood(pendingMoodContext.valence),
    tags: emotion ? [emotion] : [],
    date: formatDate(committedDate),
  };
}

function buildInitialSuggestion(
  pendingMoodContext: ReturnType<typeof useDiaryDraftStore.getState>["pendingMoodContext"],
  emotionLabel: string,
): JournalEntrySuggestion | null {
  const prefill = buildInitialPrefill(pendingMoodContext, emotionLabel);
  if (!pendingMoodContext || !prefill) return null;

  return {
    source: "orb",
    emotion: pendingMoodContext.emotion,
    mood: pendingMoodContext.mood || valenceToMood(pendingMoodContext.valence),
    scope: pendingMoodContext.scope,
    specificTime: pendingMoodContext.specificTime,
    committedAt: pendingMoodContext.committedAt,
    note: pendingMoodContext.note,
    prefill,
  };
}

interface DiaryPageProps {
  onOpenNavMenu?: () => void;
  navMenuOpen?: boolean;
  showAppNavMenu?: boolean;
  onAddGratitude?: (entry: GratitudeEntry) => void;
}

/**
 * DiaryPage — V2 adapter around the mature V1 personal-diary experience.
 *
 * This intentionally reuses the journal feature module instead of leaving V2
 * as a placeholder. Diary stays history-first like V1, while Orb handoff is
 * exposed as a soft suggestion instead of force-opening the editor.
 */
export const DiaryPage = memo(function DiaryPage({
  onOpenNavMenu,
  navMenuOpen = false,
  showAppNavMenu = false,
  onAddGratitude,
}: DiaryPageProps) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const pendingMoodContext = useDiaryDraftStore((s) => s.pendingMoodContext);
  const consumePendingMoodContext = useDiaryDraftStore(
    (s) => s.consumePendingMoodContext,
  );
  const [initialEntrySuggestion, setInitialEntrySuggestion] =
    useState<JournalEntrySuggestion | null>(null);
  useEffect(() => {
    h1Ref.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!pendingMoodContext) {
      startTransition(() => setInitialEntrySuggestion(null));
      return () => {
        cancelled = true;
      };
    }

    const emotion = pendingMoodContext.emotion?.trim() || "";
    const fallbackLabel = emotion ? capitalizeFirst(emotion) : "";

    startTransition(() => {
      setInitialEntrySuggestion(
        buildInitialSuggestion(pendingMoodContext, fallbackLabel),
      );
    });

    if (!emotion) {
      return () => {
        cancelled = true;
      };
    }

    void import("@/components/state-of-mind/emotionI18n").then(
      ({ getLocalizedEmotionLabel }) => {
        if (cancelled) return;

        const localizedLabel = getLocalizedEmotionLabel(emotion, tx);
        startTransition(() => {
          setInitialEntrySuggestion(
            buildInitialSuggestion(
              pendingMoodContext,
              localizedLabel || fallbackLabel,
            ),
          );
        });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [pendingMoodContext, tx]);

  return (
    <div className="motion-safe:animate-fade-in">
      <main
        id="main-content-v2"
        role="main"
        tabIndex={-1}
        className="v2-fullscreen-page v2-readable-page v2-readable-page--standard relative min-h-[var(--app-viewport-height)] outline-none"
        aria-labelledby="diary-page-heading"
        data-testid="diary-page"
        data-v2-readable-page="diary"
      >
        <h1
          ref={h1Ref}
          id="diary-page-heading"
          tabIndex={-1}
          className="sr-only"
        >
          {tx.navV2Diary || t.diary || "Diary"}
        </h1>

        {/* Ambient diary music is configured from Settings; keep the asset non-autoplaying and off the writing surface. */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio
          aria-hidden="true"
          data-testid="diary-page-ambience-audio"
          src={DIARY_AMBIENCE_AUDIO_SRC}
          preload="none"
          loop
          playsInline
        />

        <Suspense
          fallback={
            <SplashScreen
              loadingFadeOut={false}
              subtitle={tx.initializingApp || "Preparing your zen space..."}
              theme={appliedTheme}
              instant
            />
          }
        >
          <JournalModule
            startOpen
            disableCardShell
            hideCloseButton
            presentation="page"
            initialEntrySuggestion={initialEntrySuggestion}
            onInitialEntrySuggestionConsumed={consumePendingMoodContext}
            loadingTheme={appliedTheme}
            onOpenNavMenu={onOpenNavMenu}
            navMenuOpen={navMenuOpen}
            showAppNavMenu={showAppNavMenu}
            onAddGratitude={onAddGratitude}
          />
        </Suspense>
      </main>
    </div>
  );
});

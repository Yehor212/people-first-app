import { lazy, memo, startTransition, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { SplashScreen } from "@/components/SplashScreen";
import { useThemeStore } from "@/stores/themeStore";
import { useAppAudioSettings } from "@/hooks/useAppAudioSettings";
import { logger } from "@/lib/logger";
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
  onAddGratitude,
}: DiaryPageProps) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const ambienceAudioRef = useRef<HTMLAudioElement | null>(null);
  const ambiencePlayingRef = useRef(false);
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const pendingMoodContext = useDiaryDraftStore((s) => s.pendingMoodContext);
  const consumePendingMoodContext = useDiaryDraftStore(
    (s) => s.consumePendingMoodContext,
  );
  const [initialEntrySuggestion, setInitialEntrySuggestion] =
    useState<JournalEntrySuggestion | null>(null);
  const [isAmbiencePlaying, setIsAmbiencePlaying] = useState(false);
  const [ambienceAudioError, setAmbienceAudioError] = useState(false);
  const appAudioSettings = useAppAudioSettings();
  const ambienceVolume = appAudioSettings.muted ? 0 : Math.max(0, Math.min(1, appAudioSettings.volume * 0.32));
  const ambienceToggleLabel = isAmbiencePlaying
    ? tx.diaryAmbiencePause || "Pause diary ambience"
    : ambienceAudioError
      ? tx.audioRetry || "Retry"
      : tx.diaryAmbiencePlay || "Play diary ambience";

  const handleAmbienceToggle = useCallback(() => {
    const audio = ambienceAudioRef.current;
    if (!audio) return;

    if (isAmbiencePlaying) {
      audio.pause();
      ambiencePlayingRef.current = false;
      setIsAmbiencePlaying(false);
      setAmbienceAudioError(false);
      return;
    }

    if (appAudioSettings.muted) {
      ambiencePlayingRef.current = false;
      setIsAmbiencePlaying(false);
      setAmbienceAudioError(false);
      return;
    }

    audio.volume = ambienceVolume;
    setAmbienceAudioError(false);
    ambiencePlayingRef.current = true;
    setIsAmbiencePlaying(true);
    void audio.play().catch((error) => {
      ambiencePlayingRef.current = false;
      setIsAmbiencePlaying(false);
      setAmbienceAudioError(true);
      logger.warn("[DiaryPage]", "Diary ambience playback failed:", error);
    });
  }, [ambienceVolume, appAudioSettings.muted, isAmbiencePlaying]);

  const pauseAmbience = useCallback(() => {
    const audio = ambienceAudioRef.current;
    if (!audio || !ambiencePlayingRef.current) return;
    ambiencePlayingRef.current = false;
    audio.pause();
    setIsAmbiencePlaying(false);
    setAmbienceAudioError(false);
  }, []);

  useEffect(() => {
    h1Ref.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const audio = ambienceAudioRef.current;
    if (!audio) return;

    audio.volume = ambienceVolume;

    if (appAudioSettings.muted && isAmbiencePlaying) {
      audio.pause();
      ambiencePlayingRef.current = false;
      setIsAmbiencePlaying(false);
      setAmbienceAudioError(false);
    }
  }, [ambienceVolume, appAudioSettings.muted, isAmbiencePlaying]);

  useEffect(() => {
    const audio = ambienceAudioRef.current;

    return () => {
      if (!audio) return;
      audio.pause();
      audio.removeAttribute("src");
    };
  }, []);

  useEffect(() => {
    const pauseOnHidden = () => {
      if (document.hidden) pauseAmbience();
    };
    const pauseOnPageHide = () => pauseAmbience();

    document.addEventListener("visibilitychange", pauseOnHidden);
    window.addEventListener("pagehide", pauseOnPageHide);

    return () => {
      document.removeEventListener("visibilitychange", pauseOnHidden);
      window.removeEventListener("pagehide", pauseOnPageHide);
    };
  }, [pauseAmbience]);

  useEffect(() => {
    let cancelled = false;
    let removePause: (() => void) | null = null;

    void import("@capacitor/app")
      .then(async ({ App }) => {
        const listener = await App.addListener("pause", pauseAmbience);
        if (cancelled) {
          void listener.remove();
        } else {
          removePause = () => { void listener.remove(); };
        }
      })
      .catch((error) => logger.warn("[DiaryPage]", "Native ambience pause listener unavailable:", error));

    return () => {
      cancelled = true;
      removePause?.();
    };
  }, [pauseAmbience]);

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

        {/* Ambient diary music has no spoken content; the adjacent button provides control. */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio
          ref={ambienceAudioRef}
          aria-hidden="true"
          data-testid="diary-page-ambience-audio"
          src={DIARY_AMBIENCE_AUDIO_SRC}
          preload="none"
          loop
          playsInline
          onPlay={() => {
            setIsAmbiencePlaying(true);
            setAmbienceAudioError(false);
          }}
          onPause={() => setIsAmbiencePlaying(false)}
          onError={() => {
            setIsAmbiencePlaying(false);
            setAmbienceAudioError(true);
          }}
        />

        <div
          data-testid="diary-page-ambience-control"
          className="diary-page-ambience-control pointer-events-none absolute bottom-[calc(5.35rem+var(--safe-bottom))] start-4 z-[49] md:bottom-auto md:start-auto md:end-6 md:top-[calc(var(--safe-top)+1rem)] md:z-[59]"
        >
          <button
            type="button"
            data-testid="diary-page-ambience-toggle"
            aria-label={ambienceToggleLabel}
            aria-pressed={isAmbiencePlaying}
            title={ambienceToggleLabel}
            onClick={handleAmbienceToggle}
            disabled={appAudioSettings.muted}
            className="pointer-events-auto inline-flex min-h-[44px] max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-border/50 bg-card/70 px-3 py-2 text-xs font-semibold text-foreground shadow-[0_14px_34px_hsl(var(--foreground)/0.16)] backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)] motion-safe:transition-[background-color,border-color,color,box-shadow,transform] motion-safe:duration-200 hover:bg-card/85 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-55 md:px-4 md:text-sm"
          >
            {isAmbiencePlaying ? (
              <Volume2 className="h-4 w-4 text-primary" aria-hidden="true" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            )}
            <span className="hidden max-w-[9rem] truncate sm:inline">
              {tx.diaryAmbienceLabel || "Diary ambience"}
            </span>
            <span className="rounded-full border border-border/50 px-2 py-0.5 text-[0.68rem] font-medium text-muted-foreground">
              {isAmbiencePlaying
                ? tx.soundOn || "On"
                : ambienceAudioError
                  ? tx.audioRetry || "Retry"
                  : tx.soundOff || "Off"}
            </span>
          </button>
        </div>

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
            onAddGratitude={onAddGratitude}
          />
        </Suspense>
      </main>
    </div>
  );
});

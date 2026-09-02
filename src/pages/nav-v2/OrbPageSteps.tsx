import { type CSSProperties, type RefObject } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Bloom } from "@/lib/motion";
import { staggerDelay } from "@/lib/motion/choreography";
import { isAndroid } from "@/lib/platform";
import { cn } from "@/lib/utils";
import {
  CANONICAL_ORB_ANIMATION_SPEED,
  ValenceOrb,
} from "@/components/state-of-mind/ValenceOrb";
import { MiniValenceOrb } from "@/components/state-of-mind/MiniValenceOrb";
import { valenceToColor } from "@/components/state-of-mind/colorUtils";
import { EmotionTagGrid } from "@/components/state-of-mind/EmotionTagGrid";
import { getLocalizedEmotionLabel } from "@/components/state-of-mind/emotionI18n";
import { ValenceSlider } from "@/components/state-of-mind/ValenceSlider";
import { MoodScopeSelector } from "./MoodScopeSelector";
import { useStepScrollerReset } from "./useStepScrollerReset";
import "./OrbPageSteps.css";

type Tx = Record<string, string>;

const refineNoteAlignmentCleanup = new WeakMap<HTMLTextAreaElement, () => void>();

function alignRefineNoteForAndroidIme(textarea: HTMLTextAreaElement) {
  if (!isAndroid) return;
  const note = textarea.closest<HTMLElement>('[data-testid="orb-page-note"]');
  if (!note) return;

  refineNoteAlignmentCleanup.get(textarea)?.();

  const align = () => {
    note.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
  };
  align();

  const viewport = window.visualViewport;
  if (!viewport) return;
  let cleanupTimer: number | null = null;
  let frameId: number | null = null;
  const cleanup = () => {
    viewport.removeEventListener("resize", onResize);
    if (cleanupTimer !== null) {
      window.clearTimeout(cleanupTimer);
      cleanupTimer = null;
    }
    if (frameId !== null) {
      window.cancelAnimationFrame(frameId);
      frameId = null;
    }
    if (refineNoteAlignmentCleanup.get(textarea) === cleanup) {
      refineNoteAlignmentCleanup.delete(textarea);
    }
  };
  const onResize = () => {
    viewport.removeEventListener("resize", onResize);
    if (cleanupTimer !== null) {
      window.clearTimeout(cleanupTimer);
      cleanupTimer = null;
    }
    if (frameId !== null) window.cancelAnimationFrame(frameId);
    frameId = window.requestAnimationFrame(() => {
      frameId = null;
      align();
      cleanup();
    });
  };
  viewport.addEventListener("resize", onResize);
  cleanupTimer = window.setTimeout(cleanup, 500);
  refineNoteAlignmentCleanup.set(textarea, cleanup);
}

interface OrbSelectStepProps {
  tx: Tx;
  selectContentLayoutClass: string;
  contentGapClass: string;
  shouldAnimate: boolean;
  auraHue: number;
  auraRef: RefObject<HTMLDivElement>;
  showOrbAura: boolean;
  handleOrbTap: () => void;
  orbValence: number;
  heroOrbSize: number;
  orbAnimationSpeed?: number;
  orbAttempt: number;
  onOrbVisualReady: () => void;
  onOrbVisualError: () => void;
  draftScope: "now" | "day" | "specific";
  draftValence: number | null;
  isDenseSelectStep: boolean;
  isUltraDenseSelectStep: boolean;
  isShortViewport: boolean;
  whisperKey: string;
  whisperText: string;
  canProceedFromSelect: boolean;
  handleSliderCommit: (value: number) => void;
  handleNextStep: () => void;
}

export function OrbSelectStep({
  tx,
  selectContentLayoutClass,
  contentGapClass,
  shouldAnimate,
  auraHue,
  auraRef,
  showOrbAura,
  handleOrbTap,
  orbValence,
  heroOrbSize,
  orbAnimationSpeed = CANONICAL_ORB_ANIMATION_SPEED,
  orbAttempt,
  onOrbVisualReady,
  onOrbVisualError,
  draftScope,
  draftValence,
  isDenseSelectStep,
  isUltraDenseSelectStep,
  isShortViewport,
  whisperKey,
  whisperText,
  canProceedFromSelect,
  handleSliderCommit,
  handleNextStep,
}: OrbSelectStepProps) {
  const scrollRef = useStepScrollerReset();

  return (
    <>
      <div
        ref={scrollRef}
        className={cn(selectContentLayoutClass, contentGapClass, "orb-step-scroll-safe-center")}
      >
        <Bloom key="orb-hero" initial={false} transition={staggerDelay("primary")}>
          <div className="flex items-center justify-center" data-testid="orb-page-select">
            <div
              className="relative orb-page-rim-glow"
              data-orb-breathing={shouldAnimate ? "true" : "false"}
              data-testid="orb-page-rim-glow"
              style={
                {
                  "--orb-aura-hue": auraHue,
                  "--orb-hero-size": `${heroOrbSize}px`,
                } as CSSProperties
              }
            >
              <span className="orb-day-anchor-field" aria-hidden="true">
                <span className="orb-day-anchor-spark orb-day-anchor-spark--one" />
                <span className="orb-day-anchor-spark orb-day-anchor-spark--two" />
                <span className="orb-day-anchor-spark orb-day-anchor-spark--three" />
                <span className="orb-day-anchor-spark orb-day-anchor-spark--four" />
              </span>
              {showOrbAura ? (
                <div
                  ref={auraRef}
                  className="absolute inset-0 pointer-events-none scale-[1.8] motion-safe:transition-[background] motion-safe:duration-300 ease-out"
                  data-testid="orb-aura"
                  data-aura-hue={auraHue}
                  style={{
                    background: `radial-gradient(circle, ${valenceToColor(orbValence, 0.35)} 0%, ${valenceToColor(orbValence, 0.15)} 40%, transparent 70%)`,
                  }}
                  aria-hidden="true"
                />
              ) : null}
              <button
                type="button"
                onClick={handleOrbTap}
                aria-label={tx.somLogFeeling || "Log how you feel"}
                data-testid="orb-page-hero"
                className="relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background motion-safe:transition-transform motion-safe:duration-200 active:scale-[0.98]"
              >
                <ValenceOrb
                  key={orbAttempt}
                  valence={orbValence}
                  size={heroOrbSize}
                  animationSpeed={orbAnimationSpeed}
                  transitionProfile="input-soft"
                  renderer="webgpu"
                  onVisualReady={onOrbVisualReady}
                  onVisualError={onOrbVisualError}
                />
              </button>
            </div>
          </div>
        </Bloom>

        {!(isDenseSelectStep && draftScope === "specific") && (
          <Bloom key="orb-whisper" initial={false} transition={staggerDelay("secondary")}>
            <p
              data-testid="orb-page-whisper"
              data-whisper-key={whisperKey}
              className={cn(
                "text-center font-serif italic tracking-wide text-muted-foreground",
                isUltraDenseSelectStep
                  ? "text-[0.875rem] md:text-[0.95rem]"
                  : isDenseSelectStep
                    ? "text-[0.95rem] md:text-base"
                    : isShortViewport
                      ? "text-base md:text-lg"
                      : "text-base md:text-xl",
              )}
            >
              {whisperText}
            </p>
          </Bloom>
        )}

        <Bloom key="orb-scope" initial={false} transition={staggerDelay("secondary")}>
          <div data-testid="orb-page-scope">
            <MoodScopeSelector density={isDenseSelectStep ? "compact" : "default"} />
          </div>
        </Bloom>

        <Bloom key="orb-picker" initial={false} transition={staggerDelay("cta")}>
          <div className="mx-auto w-full" data-testid="orb-page-picker">
            <div data-testid="orb-page-slider">
              <ValenceSlider
                value={draftValence ?? 0}
                onChange={handleSliderCommit}
              />
            </div>
          </div>
        </Bloom>
      </div>

      <Bloom key="orb-select-actions" initial={false} transition={staggerDelay("cta")}>
        <div
          className="pointer-events-none relative z-20 shrink-0 pt-3 md:pt-4"
          data-testid="orb-page-footer"
        >
          <div
            className="pointer-events-auto flex flex-wrap items-center justify-center gap-3"
            data-testid="orb-page-select-actions"
          >
            <button
              type="button"
              onClick={handleNextStep}
              disabled={!canProceedFromSelect}
              className={cn(
                "inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed",
                canProceedFromSelect
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground",
              )}
              data-testid="orb-page-next"
            >
              <span>{tx.next || "Next"}</span>
              <ArrowRight className="h-4 w-4 rtl:scale-x-[-1]" aria-hidden="true" />
            </button>
          </div>
        </div>
      </Bloom>
    </>
  );
}

interface OrbRefineStepProps {
  tx: Tx;
  contentGapClass: string;
  resolvedValence: number;
  scopeLabel: string;
  moodLabel: string;
  draftEmotion: string | null;
  draftNote: string;
  canOpenDiary: boolean;
  isSavingMood: boolean;
  saveErrorMessage: string | null;
  handleEmotionToggle: (tag: string) => void;
  handleNoteChange: (value: string) => void;
  handleBackStep: () => void;
  handleSaveMood: () => Promise<void>;
  handleOpenDiary: () => Promise<void>;
}

export function OrbRefineStep({
  tx,
  contentGapClass,
  resolvedValence,
  scopeLabel,
  moodLabel,
  draftEmotion,
  draftNote,
  canOpenDiary,
  isSavingMood,
  saveErrorMessage,
  handleEmotionToggle,
  handleNoteChange,
  handleBackStep,
  handleSaveMood,
  handleOpenDiary,
}: OrbRefineStepProps) {
  const scrollRef = useStepScrollerReset();
  const refineHeading = draftEmotion
    ? getLocalizedEmotionLabel(draftEmotion, tx)
    : tx.howAreYouFeeling || "How are you feeling?";

  return (
    <div
      ref={scrollRef}
      className={cn(
        "orb-page-refine-scroll flex flex-1 min-h-0 flex-col justify-start overflow-y-auto overflow-x-hidden px-2 pb-3 md:px-4 md:pb-4",
        contentGapClass,
      )}
      data-testid="orb-page-refine-scroll"
    >
        <Bloom key="orb-refine-header" initial={false} transition={staggerDelay("primary")}>
          <section
            className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-0 text-center md:flex-row md:items-start md:text-left"
            data-testid="orb-page-refine"
          >
            <MiniValenceOrb
              valence={resolvedValence}
              hasEntry={true}
              size="lg"
              chrome="refine"
              containerClassName="mt-1 shrink-0"
            />

            <div className="w-full max-w-full min-w-0 flex-1 md:w-auto">
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground md:justify-start">
                <span>{scopeLabel}</span>
                <span className="h-1 w-1 rounded-full bg-current/50" aria-hidden="true" />
                <span>{moodLabel}</span>
              </div>
              <h2
                className="mt-3 min-w-0 max-w-full break-words font-display text-[1.0625rem] font-semibold tracking-tight text-foreground [hyphens:manual] [overflow-wrap:normal] min-[360px]:text-2xl md:text-3xl"
                data-testid="orb-page-refine-heading"
              >
                {refineHeading}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground md:text-base">
                {tx.journalPrompt6 || tx.howAreYouFeeling || "How are you feeling right now?"}
              </p>
            </div>
          </section>
        </Bloom>

        <Bloom key="orb-refine-emotion" initial={false} transition={staggerDelay("secondary")}>
          <div className="mx-auto max-w-2xl px-0" data-testid="orb-page-emotion-spectrum">
            <EmotionTagGrid
              valence={resolvedValence}
              selected={draftEmotion ? [draftEmotion] : []}
              onToggle={handleEmotionToggle}
              expandable
            />
          </div>
        </Bloom>

        <Bloom key="orb-refine-note" initial={false} transition={staggerDelay("cta")}>
          <div className="mx-auto max-w-2xl px-0" data-testid="orb-page-note">
              <label
                htmlFor="orb-refine-note-input"
                className="mb-2 block text-sm font-medium text-foreground/90 [hyphens:auto] [overflow-wrap:normal] [word-break:normal] [@media(max-height:360px)]:px-16 [@media(max-height:360px)]:text-center"
              >
              {tx.journalContinueWriting || "Continue writing"}
            </label>
            <textarea
              id="orb-refine-note-input"
              data-testid="orb-page-note-input"
              value={draftNote}
              onChange={(event) => handleNoteChange(event.target.value)}
              onFocus={(event) => alignRefineNoteForAndroidIme(event.currentTarget)}
              maxLength={280}
              rows={4}
              aria-label={tx.journalContinueWriting || "Continue writing"}
              placeholder={tx.howAreYouFeeling || "How are you feeling?"}
              className="min-h-[120px] w-full rounded-[28px] border border-border/60 bg-card/65 px-4 py-3 text-sm text-foreground shadow-sm outline-none backdrop-blur-md transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20 [@media(max-height:360px)]:h-[96px] [@media(max-height:360px)]:min-h-[96px] md:text-base"
            />
          </div>
        </Bloom>

      <Bloom key="orb-refine-actions" initial={false} transition={staggerDelay("cta")}>
        <div
          className="pointer-events-none relative z-20 mt-auto shrink-0 pt-3 md:pt-4"
          data-testid="orb-page-footer"
        >
          <div
            className="pointer-events-auto mx-auto flex w-full max-w-2xl flex-col items-stretch justify-between gap-3 px-0 sm:flex-row sm:flex-wrap sm:items-center sm:px-2"
            data-testid="orb-page-refine-actions"
          >
            <button
              type="button"
              onClick={handleBackStep}
              disabled={isSavingMood}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-2.5 text-sm font-medium text-foreground backdrop-blur-md transition-colors hover:bg-[hsl(var(--zf-memory)/0.14)] sm:w-auto sm:px-5"
              data-testid="orb-page-back"
            >
              <ArrowLeft className="h-4 w-4 rtl:scale-x-[-1]" aria-hidden="true" />
              <span>{tx.back || "Back"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                void handleSaveMood();
              }}
              disabled={!canOpenDiary || isSavingMood}
              className="orb-page-continuation-button inline-flex min-h-[44px] w-full min-w-0 max-w-full items-center justify-center gap-2 whitespace-normal bg-primary px-3 py-2.5 text-center text-sm font-medium leading-snug text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:flex-1 sm:px-5"
              data-testid="orb-page-save-mood"
            >
              <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 [hyphens:manual] [overflow-wrap:normal] [word-break:normal]">
                {isSavingMood ? tx.saving || "Saving…" : tx.saveMood || "Save mood"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                void handleOpenDiary();
              }}
              disabled={!canOpenDiary || isSavingMood}
              className="orb-page-continuation-button inline-flex min-h-[44px] w-full min-w-0 max-w-full items-center justify-center gap-2 whitespace-normal border border-border/60 bg-background/70 px-3 py-2.5 text-center text-sm font-medium leading-snug text-foreground backdrop-blur-md transition-colors hover:bg-[hsl(var(--zf-memory)/0.14)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:flex-1 sm:px-5"
              data-testid="orb-page-open-diary"
            >
              <span className="min-w-0 flex-1 [hyphens:manual] [overflow-wrap:normal] [word-break:normal]">
                {isSavingMood
                  ? tx.saving || "Saving…"
                  : tx.orbSaveMoodAndStartEntry || "Save mood and start today's entry"}
              </span>
              <ArrowRight
                className="orb-page-save-arrow h-4 w-4 shrink-0 rtl:scale-x-[-1]"
                aria-hidden="true"
              />
            </button>
          </div>
          {saveErrorMessage ? (
            <p
              role="alert"
              className="mx-auto mt-3 max-w-2xl text-center text-sm text-destructive"
              data-testid="orb-page-save-error"
            >
              {saveErrorMessage}
            </p>
          ) : null}
        </div>
      </Bloom>
    </div>
  );
}

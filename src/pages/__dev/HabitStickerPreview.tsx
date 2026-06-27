import { useState } from "react";
import {
  HabitStickerModel,
  type HabitStickerModelState,
} from "@/components/habit-pictogram/HabitStickerModel";
import "./HabitStickerPreview.css";

const STATES: readonly HabitStickerModelState[] = ["idle", "complete", "streak"];

export default function HabitStickerPreview() {
  const [state, setState] = useState<HabitStickerModelState>("idle");

  if (!import.meta.env.DEV) return null;

  return (
    <main className="habit-sticker-preview min-h-screen" data-testid="habit-sticker-preview">
      <div className="habit-sticker-preview__shell">
        <header className="habit-sticker-preview__header">
          <div>
            <h1 className="habit-sticker-preview__title">Sneaker Sticker Model</h1>
            <p className="habit-sticker-preview__meta">
              walk-distance review blocked / awaiting vector TGS-Lottie sneaker rig / V2 habit states
            </p>
          </div>
          <div className="habit-sticker-preview__controls" aria-label="Sticker state">
            {STATES.map((nextState) => (
              <button
                key={nextState}
                type="button"
                className="habit-sticker-preview__control"
                data-active={state === nextState ? "true" : "false"}
                onClick={() => setState(nextState)}
              >
                {nextState}
              </button>
            ))}
          </div>
        </header>

        <section className="habit-sticker-preview__stage-card" aria-label="Sneaker sticker model">
          <div className="habit-sticker-preview__hero" data-testid="habit-sticker-preview-hero">
            <HabitStickerModel
              pictogramId="walk-distance"
              state={state}
              showCaption
              streakCount={7}
            />
          </div>

          <div className="habit-sticker-preview__spec">
            <h2>Telegram-style sneaker habit object</h2>
            <dl className="habit-sticker-preview__spec-list">
              <div className="habit-sticker-preview__spec-row">
                <dt>Core</dt>
                <dd>awaiting walk-distance/idle.lottie.json or .tgs source</dd>
              </div>
              <div className="habit-sticker-preview__spec-row">
                <dt>Renderer</dt>
                <dd>blocked until vector Lottie/TGS rig</dd>
              </div>
              <div className="habit-sticker-preview__spec-row">
                <dt>Loop</dt>
                <dd>2983ms / 60fps</dd>
              </div>
              <div className="habit-sticker-preview__spec-row">
                <dt>State</dt>
                <dd>{state}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="habit-sticker-preview__grid" aria-label="State set">
          {STATES.map((tileState) => (
            <article
              key={tileState}
              className="habit-sticker-preview__tile"
              data-testid={`habit-sticker-preview-tile-${tileState}`}
            >
              <HabitStickerModel pictogramId="walk-distance" state={tileState} streakCount={7} />
              <p className="habit-sticker-preview__tile-label">{tileState}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

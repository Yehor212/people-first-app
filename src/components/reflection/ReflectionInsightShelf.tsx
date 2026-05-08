import { memo, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, FlaskConical, Lightbulb, Sparkles, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ReflectionInsightCard, ReflectionInsightStatus } from "@/types";

interface ReflectionInsightShelfProps {
  tx: Record<string, string>;
  insights: ReflectionInsightCard[];
  onUpdateStatus: (id: string, status: ReflectionInsightStatus) => void;
  compact?: boolean;
  className?: string;
}

function statusLabel(status: ReflectionInsightStatus, tx: Record<string, string>): string {
  switch (status) {
    case "saved":
      return tx.reflectionInsightStatusSaved || "Saved";
    case "testing":
      return tx.reflectionInsightStatusTesting || "Testing";
    case "learned":
      return tx.reflectionInsightStatusLearned || "Learned";
    case "dismissed":
      return tx.reflectionInsightHide || "Hidden";
    case "new":
    default:
      return tx.reflectionInsightStatusNew || "New";
  }
}

export const ReflectionInsightShelf = memo(function ReflectionInsightShelf({
  tx,
  insights,
  onUpdateStatus,
  compact = false,
  className,
}: ReflectionInsightShelfProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const visibleInsights = useMemo(
    () => insights.filter((insight) => insight.status !== "dismissed").slice(0, compact ? 1 : 2),
    [compact, insights],
  );

  if (visibleInsights.length === 0) return null;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-[30px] border border-border/70 bg-card/88 p-5 shadow-sm backdrop-blur-xl",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Lightbulb className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {tx.reflectionSuggestionsTitle || "Reflection quality"}
          </p>
          <h3 className="text-lg font-semibold tracking-tight text-foreground">
            {tx.insightsTitle || "Personal insights"}
          </h3>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {visibleInsights.map((insight) => {
          const expanded = expandedId === insight.id;
          const confidence = Math.round(insight.confidence * 100);
          return (
            <article
              key={insight.id}
              className="rounded-[24px] border border-border/60 bg-background/72 p-4"
            >
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : insight.id)}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-primary">
                      {statusLabel(insight.status, tx)}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-foreground">
                      {insight.impact}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {confidence}% {tx.insightConfidence || "confidence"}
                    </span>
                  </div>
                  <h4 className="mt-3 text-base font-semibold text-foreground">
                    {insight.title}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {insight.summary}
                  </p>
                </div>
                {expanded ? (
                  <ChevronUp className="mt-1 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <ChevronDown className="mt-1 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                )}
              </button>

              {expanded ? (
                <div className="mt-4 space-y-4 border-t border-border/50 pt-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {tx.reflectionInsightExperiment || "Suggested experiment"}
                    </p>
                    <div className="mt-2 flex items-start gap-2 rounded-2xl border border-border/50 bg-card/70 px-3 py-3 text-sm text-foreground">
                      <FlaskConical className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
                      <span>{insight.experiment}</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {tx.reflectionEvidenceLabel || "Evidence"}
                    </p>
                    <div className="mt-2 space-y-2">
                      {insight.evidence.map((evidence) => (
                        <div
                          key={`${insight.id}-${evidence.label}`}
                          className="rounded-2xl border border-border/50 bg-card/70 px-3 py-3"
                        >
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                            {evidence.label}
                          </p>
                          <p className="mt-1 text-sm text-foreground">{evidence.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {insight.status === "new" ? (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(insight.id, "saved")}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border/70 bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                      >
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                        <span>{tx.reflectionInsightSave || "Save insight"}</span>
                      </button>
                    ) : null}

                    {insight.status === "testing" ? (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(insight.id, "learned")}
                        className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        {tx.reflectionInsightLearned || "Mark learned"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(insight.id, "testing")}
                        className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        {tx.reflectionInsightTest || "Test this week"}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onUpdateStatus(insight.id, "dismissed")}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border/70 bg-background/80 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                      <span>{tx.reflectionInsightHide || "Hide"}</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
});

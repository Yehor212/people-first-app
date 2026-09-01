import { memo } from "react";
import { CalendarDays, Clock3 } from "lucide-react";
import { GlobalScheduleBar } from "@/components/GlobalScheduleBar";
import type { TranslationStrings } from "@/i18n/types";
import type { ScheduleEvent } from "@/types";

interface PlanningOverviewProps {
  labels: TranslationStrings;
  todayScheduleEvents: ScheduleEvent[];
  onOpenSchedule: () => void;
}

export const PlanningOverview = memo(function PlanningOverview({
  labels,
  todayScheduleEvents,
  onOpenSchedule,
}: PlanningOverviewProps) {
  return (
    <>
      <header className="flex min-w-0 flex-col gap-3">
        <div className="inline-flex w-fit max-w-full min-w-0 items-center gap-2 whitespace-normal text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="min-w-0 break-words [hyphens:manual] [overflow-wrap:normal]">
            {labels.navV2Planning}
          </span>
        </div>
        <div className="min-w-0 max-w-3xl space-y-2">
          <h1
            id="planning-page-heading"
            className="min-w-0 break-words font-display text-xl font-semibold leading-[1.02] text-foreground [hyphens:manual] [overflow-wrap:normal] min-[420px]:text-3xl md:text-display-5xl"
          >
            {labels.navV2PlanningHeading}
          </h1>
          <p className="min-w-0 max-w-2xl break-words text-base leading-7 text-muted-foreground [hyphens:manual] [overflow-wrap:normal] md:text-lg">
            {labels.navV2PlanningSubcopy}
          </p>
        </div>
      </header>

      <section aria-label={labels.viewSchedule} className="space-y-3">
        {todayScheduleEvents.length > 0 ? (
          <GlobalScheduleBar events={todayScheduleEvents} onTap={onOpenSchedule} />
        ) : (
          <button
            type="button"
            onClick={onOpenSchedule}
            data-testid="planning-empty-schedule"
            className="flex min-h-[64px] w-full min-w-0 items-center gap-3 whitespace-normal rounded-2xl border border-border/50 bg-card px-4 py-3 text-start text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Clock3 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 flex-1 break-words [hyphens:manual] [overflow-wrap:normal]">
              {labels.navV2PlanningEmpty}
            </span>
          </button>
        )}
      </section>
    </>
  );
});

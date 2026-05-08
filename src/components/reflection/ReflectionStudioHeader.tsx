import { memo } from "react";

import type { DayRitual, ReflectionInsightStatus } from "@/types";

import { ReflectionInsightShelf } from "./ReflectionInsightShelf";

interface ReflectionStudioHeaderProps {
  tx: Record<string, string>;
  recommendedType?: "opening" | "closing" | null;
  openingRitual?: DayRitual;
  closingRitual?: DayRitual;
  onSaveRitual?: (
    type: DayRitual["type"],
    values: Partial<DayRitual>,
  ) => DayRitual;
  insights: Array<{
    id: string;
    title: string;
    summary: string;
    experiment: string;
    confidence: number;
    impact: "high" | "medium" | "low";
    evidence: Array<{ label: string; detail: string; metric?: string }>;
    status: ReflectionInsightStatus;
    source: "behavior-pattern" | "ritual-pattern" | "focus-pattern" | "mood-pattern";
    createdAt: number;
    updatedAt: number;
  }>;
  onUpdateInsightStatus: (id: string, status: ReflectionInsightStatus) => void;
}

export const ReflectionStudioHeader = memo(function ReflectionStudioHeader({
  tx,
  insights,
  onUpdateInsightStatus,
}: ReflectionStudioHeaderProps) {
  return <ReflectionInsightShelf tx={tx} insights={insights} onUpdateStatus={onUpdateInsightStatus} />;
});

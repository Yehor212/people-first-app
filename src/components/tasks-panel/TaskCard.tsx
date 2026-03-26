import { memo } from "react";
import { Zap, Clock, Star, Trash2, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PrioritizedTask } from "./types";

interface TaskCardProps {
  task: PrioritizedTask;
  index?: number;
  onToggle: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  t: Record<string, string>;
}

export const TaskCard = memo(function TaskCard({
  task,
  index,
  onToggle,
  onDelete,
  t,
}: TaskCardProps) {
  const isTopThree = index !== undefined && index < 3;

  return (
    <div
      className={cn(
        "p-4 rounded-2xl transition-all duration-300 motion-safe:animate-fade-in",
        task.completed
          ? "bg-primary/5 opacity-70 scale-95"
          : isTopThree
            ? "zen-gradient-card zen-shadow-soft border-2 border-primary/30 hover:zen-shadow"
            : "bg-card border border-border hover:border-primary/30 hover:zen-shadow-soft",
      )}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => onToggle(task.id)}
          className={cn(
            "mt-1 flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors",
            task.completed
              ? "text-primary"
              : "text-muted-foreground hover:text-primary",
          )}
          aria-label={t.markComplete || "Toggle complete"}
        >
          {task.completed ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <Circle className="w-5 h-5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4
              className={cn(
                "font-medium min-w-0 truncate",
                task.completed && "line-through text-muted-foreground",
              )}
            >
              {task.name}
            </h4>
            {isTopThree && !task.completed && (
              <span className="flex-shrink-0 px-2 py-1 text-xs font-bold zen-gradient text-white rounded-full">
                Top {index + 1}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
            {task.urgent && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-destructive/10 text-destructive rounded-md text-xs font-medium">
                <Zap className="w-3 h-3" />
                {t.urgent || "Urgent"}
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-xs">
              <Clock className="w-3 h-3" />
              {task.estimatedMinutes} {t.min || "min"}
            </span>
            {task.userRating && task.userRating >= 7 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 rounded-md text-xs">
                <Star className="w-3 h-3" />
                {task.userRating}/10
              </span>
            )}
          </div>

          {!task.completed && (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-muted-foreground">{task.reasoning}</p>
              <p className="text-xs font-medium text-primary">
                {task.encouragement}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={() => onDelete(task.id)}
          className="flex-shrink-0 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
          aria-label={t.delete || "Delete"}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

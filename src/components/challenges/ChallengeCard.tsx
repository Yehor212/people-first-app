import { memo } from "react";
import { motion } from "framer-motion";
import { zenTap } from "@/lib/animationUtils";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Translations } from "@/i18n/types";
import {
  Challenge,
  getChallengeProgress,
  getDaysRemaining,
} from "@/lib/friendChallenge";

export const ChallengeCard = memo(function ChallengeCard({
  challenge,
  onClick,
  t,
}: {
  challenge: Challenge;
  onClick: () => void;
  t: Translations;
}) {
  const progress = getChallengeProgress(challenge);
  const daysLeft = getDaysRemaining(challenge);

  const statusConfig = {
    active: {
      bg: "bg-gradient-to-r from-emerald-500/80 to-teal-500/80",
      glow: "rgba(16, 185, 129, 0.4)",
      progressBg: "bg-gradient-to-r from-emerald-500 to-teal-500",
    },
    completed: {
      bg: "bg-gradient-to-r from-amber-500/80 to-orange-500/80",
      glow: "rgba(245, 158, 11, 0.4)",
      progressBg: "bg-gradient-to-r from-amber-500 to-orange-500",
    },
    expired: {
      bg: "bg-muted-foreground/50",
      glow: "transparent",
      progressBg: "bg-muted-foreground/50",
    },
  }[challenge.status];

  return (
    <motion.button
      onClick={onClick}
      aria-label={`${challenge.habitName} — ${challenge.status}`}
      className={cn(
        "relative w-full min-w-0 p-4 rounded-2xl text-start overflow-hidden",
        "bg-slate-100/60 dark:bg-white/5 backdrop-blur-sm border border-slate-200/60 dark:border-white/10",
        "hover:bg-slate-200/60 dark:hover:bg-white/10 motion-safe:transition-all",
      )}
      whileHover={{ scale: 1.01, y: -2 }}
      whileTap={zenTap.card}
    >
      {/* Gradient accent on left */}
      <div className="absolute top-0 start-0 w-1 h-full bg-gradient-to-b from-violet-500 to-purple-600 shadow-[0_0_8px_rgba(139,92,246,0.4)]" />

      <div className="flex min-w-0 items-start justify-between gap-3 ps-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="text-3xl shrink-0 p-2 rounded-xl bg-gradient-to-br from-[rgba(139,92,246,0.15)] to-[rgba(168,85,247,0.1)]">
            {challenge.habitIcon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="min-w-0 break-words font-medium text-slate-800 dark:text-white [overflow-wrap:anywhere]">
              {challenge.habitName}
            </p>
            <p className="min-w-0 break-words text-xs text-slate-500 dark:text-white/60 [overflow-wrap:anywhere]">
              {challenge.isCreator
                ? t.youCreated || "You created this"
                : `${t.createdBy || "Created by"} ${challenge.creatorName || t.friend || "a friend"}`}
            </p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-400 dark:text-white/40 flex-shrink-0 rtl:scale-x-[-1]" />
      </div>

      {/* Progress bar - Premium */}
      <div className="mt-3 ps-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1.5">
          <span className="min-w-0 break-words text-slate-500 dark:text-white/60 [hyphens:manual] [overflow-wrap:break-word]">
            {challenge.myProgress}/{challenge.duration} {t.days || "days"}
          </span>
          <span
            className={cn(
              "max-w-full min-w-0 whitespace-normal break-words px-2.5 py-1 rounded-full text-white text-xs font-medium [hyphens:manual] [overflow-wrap:break-word]",
              statusConfig.bg,
            )}
            style={{ boxShadow: `0 0 12px ${statusConfig.glow}` }}
          >
            {challenge.status === "active"
              ? `${daysLeft} ${t.daysLeft || "days left"}`
              : challenge.status === "completed"
                ? t.completed || "Completed!"
                : t.expired || "Expired"}
          </span>
        </div>
        <div className="h-2.5 bg-slate-200/60 dark:bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className={cn(
              "h-full rounded-full w-full origin-left",
              statusConfig.progressBg,
            )}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: progress / 100 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{ boxShadow: `0 0 8px ${statusConfig.glow}` }}
          />
        </div>
      </div>
    </motion.button>
  );
});

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { zenTap } from "@/lib/animationUtils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useModalA11y } from "@/hooks/useModalA11y";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useBackHandler } from "@/hooks/useBackHandler";
import {
  Trophy,
  Flame,
  Star,
  Users,
  Eye,
  EyeOff,
  RefreshCw,
  Medal,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SkeletonList } from "@/components/ui/skeleton";
import { formatRank, type LeaderboardType } from "@/lib/leaderboard";
import type { LeaderboardProps } from "./types";
import { getCurrentRank } from "./types";
import { useLeaderboardData } from "./useLeaderboardData";
import { LeaderboardEntryRow } from "./LeaderboardEntryRow";

export function Leaderboard({ trigger }: LeaderboardProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<LeaderboardType>("weekly");

  useModalA11y(isOpen, () => setIsOpen(false));
  useScrollLock(isOpen);
  useBackHandler(isOpen, () => setIsOpen(false));

  const data = useLeaderboardData({
    activeTab,
    isOpen,
    timeoutLabel: t.leaderboardTimeout || "",
    loadErrorLabel: t.leaderboardLoadError || "",
  });

  const tabs: {
    type: LeaderboardType;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      type: "weekly",
      label: t.weekly || "Weekly",
      icon: <Trophy className="w-4 h-4" />,
    },
    {
      type: "monthly",
      label: t.monthly || "Monthly",
      icon: <Star className="w-4 h-4" />,
    },
    {
      type: "streak",
      label: t.streak || "Streak",
      icon: <Flame className="w-4 h-4" />,
    },
  ];

  const currentRank = getCurrentRank(data.userRanks, activeTab);

  return (
    <>
      {/* Trigger */}
      <div onClick={() => setIsOpen(true)}>
        {trigger || (
          <button
            className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
            aria-label={t.leaderboard || "Leaderboard"}
          >
            <Trophy className="w-5 h-5 text-primary" />
            <span className="font-medium">
              {t.leaderboard || "Leaderboard"}
            </span>
          </button>
        )}
      </div>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm motion-safe:animate-fade-in"
            onClick={() => setIsOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.leaderboard || "Leaderboard"}
            className="fixed bottom-0 inset-x-0 z-[60] rounded-t-[2rem] bg-background max-h-[85dvh] overflow-hidden motion-safe:animate-slide-up pb-safe"
          >
            <div className="pb-4 px-6 pt-6 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <Trophy className="w-6 h-6 text-primary" />
                {t.leaderboard || "Leaderboard"}
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                aria-label={t.close || "Close"}
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="px-6 overflow-y-auto max-h-[calc(85dvh-72px)]">
              {/* Tabs */}
              <div
                role="tablist"
                aria-label={t.leaderboardType || "Leaderboard type"}
                className="flex gap-1.5 p-1.5 mb-4 rounded-xl bg-[hsl(var(--foreground)/0.05)]"
              >
                {tabs.map((tab) => (
                  <motion.button
                    key={tab.type}
                    role="tab"
                    aria-selected={activeTab === tab.type}
                    aria-controls={`leaderboard-${tab.type}`}
                    onClick={() => setActiveTab(tab.type)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-medium transition-all",
                      activeTab === tab.type
                        ? "bg-gradient-to-r from-violet-500/80 to-purple-600/80 text-white"
                        : "text-foreground/60 hover:text-foreground hover:bg-foreground/5",
                    )}
                    style={
                      activeTab === tab.type
                        ? {
                            boxShadow: "0 0 12px rgba(139, 92, 246, 0.3)",
                          }
                        : undefined
                    }
                    whileHover={{ scale: activeTab !== tab.type ? 1.02 : 1 }}
                    whileTap={zenTap.card}
                  >
                    {tab.icon}
                    <span className="text-sm">{tab.label}</span>
                  </motion.button>
                ))}
              </div>

              {/* Opt-in Settings */}
              <div className="rounded-xl p-4 mb-4 bg-[linear-gradient(135deg,hsl(var(--foreground)/0.05)_0%,hsl(var(--foreground)/0.02)_100%)] border border-[hsl(var(--foreground)/0.1)]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {data.isOptedIn ? (
                      <Eye className="w-4 h-4 text-violet-400" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-foreground/40" />
                    )}
                    <span className="font-medium text-sm text-foreground/80">
                      {t.showOnLeaderboard || "Show on leaderboard"}
                    </span>
                  </div>
                  <Switch
                    checked={data.isOptedIn}
                    onCheckedChange={(checked) =>
                      void data.handleOptInToggle(checked)
                    }
                    aria-label={t.showOnLeaderboard || "Show on leaderboard"}
                  />
                </div>

                {data.isOptedIn && (
                  <div className="flex gap-2">
                    <Input
                      value={data.displayName}
                      onChange={(e) => data.setDisplayName(e.target.value)}
                      placeholder={t.displayName || "Display name"}
                      maxLength={20}
                      className="flex-1 bg-foreground/10 border-foreground/10 text-foreground placeholder:text-foreground/40"
                      onBlur={() => void data.handleNameUpdate()}
                      onKeyDown={(e) =>
                        e.key === "Enter" && void data.handleNameUpdate()
                      }
                    />
                  </div>
                )}

                {data.isOptedIn && currentRank && (
                  <motion.div
                    className="mt-3 flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-[rgba(139,92,246,0.15)]"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Medal className="w-4 h-4 text-violet-400" />
                    <span className="text-foreground/70">
                      {t.yourRank || "Your rank"}:{" "}
                      <strong className="text-violet-700 dark:text-violet-300">
                        {formatRank(currentRank)}
                      </strong>
                      {data.userRanks && (
                        <span className="text-foreground/40">
                          {" "}
                          / {data.userRanks.totalParticipants}
                        </span>
                      )}
                    </span>
                  </motion.div>
                )}
              </div>

              {/* Leaderboard List */}
              <div
                id={`leaderboard-${activeTab}`}
                role="tabpanel"
                aria-label={`${tabs.find((tb) => tb.type === activeTab)?.label} leaderboard`}
                className="space-y-2 overflow-y-auto max-h-[45dvh] pb-4"
              >
                {data.isLoading ? (
                  <div className="py-4">
                    <SkeletonList count={5} />
                  </div>
                ) : data.error ? (
                  <div
                    className="text-center py-12"
                    role="status"
                    aria-live="polite"
                  >
                    <Trophy className="w-12 h-12 mx-auto mb-3 text-destructive/50" />
                    <p className="text-destructive mb-3">{data.error}</p>
                    <button
                      onClick={() => void data.loadData(0)}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      {t.retry || "Retry"}
                    </button>
                  </div>
                ) : data.entries.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>{t.noParticipants || "No participants yet"}</p>
                    <p className="text-sm mt-1">
                      {t.beFirst || "Be the first to join!"}
                    </p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {data.entries.map((entry, index) => (
                      <LeaderboardEntryRow
                        key={entry.id}
                        entry={entry}
                        index={index}
                        activeTab={activeTab}
                        t={t as unknown as Record<string, string>}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </div>

            {/* Refresh button */}
            <motion.button
              onClick={() => void data.loadData(0)}
              disabled={data.isLoading}
              className="absolute top-4 end-4 p-2.5 rounded-xl bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 transition-colors"
              aria-label={t.refresh || "Refresh"}
              whileHover={{ scale: 1.05 }}
              whileTap={zenTap.button}
            >
              <RefreshCw
                className={cn(
                  "w-5 h-5 text-foreground/60",
                  data.isLoading && "animate-spin",
                )}
              />
            </motion.button>
          </div>
        </>
      )}
    </>
  );
}

export default Leaderboard;

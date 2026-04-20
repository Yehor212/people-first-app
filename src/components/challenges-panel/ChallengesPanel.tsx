import { useState } from "react";
import { Trophy, Target, CheckCircle2, Plus, X } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { useLanguage } from "@/contexts/LanguageContext";
import { Challenge, Badge } from "@/types";
import {
  challengeTemplates,
  createChallengeFromTemplate,
} from "@/lib/challenges";
import { getBadgeById, getRarityColor } from "@/lib/badges";
import { hapticTap } from "@/lib/haptics";
import { VirtualGrid, shouldVirtualize } from "@/components/ui/virtual-list";
import { EmojiOrIcon } from "@/components/icons";
import { useBackHandler } from "@/hooks/useBackHandler";
import { useModalA11y } from "@/hooks/useModalA11y";
import { useScrollLock } from "@/hooks/useScrollLock";
import { UnifiedShareModal } from "@/components/share";
import { BadgeCard } from "./BadgeCard";

interface ChallengesPanelProps {
  activeChallenges: Challenge[];
  badges: Badge[];
  onStartChallenge: (challenge: Challenge) => void;
  onClose: () => void;
}

export function ChallengesPanel({
  activeChallenges,
  badges,
  onStartChallenge,
  onClose,
}: ChallengesPanelProps) {
  const { t, language } = useLanguage();
  const [selectedTab, setSelectedTab] = useState<
    "active" | "available" | "badges"
  >("active");
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  useBackHandler(!showShareModal, onClose);
  useModalA11y(!showShareModal, onClose);
  useBackHandler(showShareModal, () => setShowShareModal(false));
  useModalA11y(showShareModal, () => setShowShareModal(false));
  useScrollLock(true);

  const handleShareBadge = (badge: Badge) => {
    void hapticTap();
    setSelectedBadge(badge);
    setShowShareModal(true);
  };

  const getProgressPercent = (challenge: Challenge) => {
    return Math.min(
      100,
      Math.round((challenge.progress / challenge.target) * 100),
    );
  };

  const getChallengeTypeLabel = (type: Challenge["type"]) => {
    switch (type) {
      case "streak":
        return t.challengeTypeStreak || "Streak";
      case "focus":
        return t.challengeTypeFocus || "Focus";
      case "gratitude":
        return t.challengeTypeGratitude || "Gratitude";
      case "total":
        return t.challengeTypeTotal || "Total";
      default:
        return "Challenge";
    }
  };

  const isTemplateActive = (templateIndex: number) => {
    const template = challengeTemplates[templateIndex];
    return activeChallenges.some(
      (c) =>
        c.type === template.type &&
        c.target === template.target &&
        !c.completed,
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="challenges-title"
      className="fixed inset-0 bg-background/95 backdrop-blur-sm z-[60] flex items-center justify-center p-4 motion-safe:animate-fade-in"
    >
      <div className="w-full max-w-2xl max-h-[90dvh] flex flex-col bg-card rounded-3xl zen-shadow-card overflow-hidden">
        {/* Header */}
        <div className="zen-gradient p-6 flex items-center justify-between">
          <div>
            <h2
              id="challenges-title"
              className="text-2xl font-bold text-primary-foreground mb-1"
            >
              {t.challengesTitle || "Challenges & Badges"}
            </h2>
            <p className="text-sm text-primary-foreground/80">
              {t.challengesSubtitle || "Take on challenges and earn badges"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t.close || "Close"}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 motion-safe:transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-6 h-6 text-primary-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-4 border-b border-border overflow-x-auto scrollbar-hide snap-x snap-mandatory">
          <button
            onClick={() => setSelectedTab("active")}
            className={`snap-start flex-shrink-0 py-2.5 px-3 rounded-xl font-medium text-sm motion-safe:transition-all ${
              selectedTab === "active"
                ? "bg-primary text-primary-foreground zen-shadow"
                : "bg-secondary text-secondary-foreground hover:bg-muted"
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <Target className="w-4 h-4" />
              {t.activeChallenges || "Active"}
              {activeChallenges.length > 0 && (
                <span className="bg-primary-foreground/20 px-1.5 py-0.5 rounded-full text-xs">
                  {activeChallenges.length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setSelectedTab("available")}
            className={`snap-start flex-shrink-0 py-2.5 px-3 rounded-xl font-medium text-sm motion-safe:transition-all ${
              selectedTab === "available"
                ? "bg-primary text-primary-foreground zen-shadow"
                : "bg-secondary text-secondary-foreground hover:bg-muted"
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <Plus className="w-4 h-4" />
              {t.availableChallenges || "Available"}
            </div>
          </button>
          <button
            onClick={() => setSelectedTab("badges")}
            className={`snap-start flex-shrink-0 py-2.5 px-3 rounded-xl font-medium text-sm motion-safe:transition-all ${
              selectedTab === "badges"
                ? "bg-primary text-primary-foreground zen-shadow"
                : "bg-secondary text-secondary-foreground hover:bg-muted"
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <Trophy className="w-4 h-4" />
              {t.badges || "Badges"}
              {badges.filter((b) => b.unlocked).length > 0 && (
                <span className="bg-primary-foreground/20 px-1.5 py-0.5 rounded-full text-xs">
                  {badges.filter((b) => b.unlocked).length}
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Active Challenges Tab */}
          {selectedTab === "active" && (
            <>
              {activeChallenges.length === 0 ? (
                <EmptyState
                  icon={<Trophy className="w-6 h-6 text-primary" />}
                  title={t.noChallengesActive || "No Active Challenges"}
                  message={
                    t.noChallengesActiveHint ||
                    "Start a challenge to track your progress"
                  }
                  action={{
                    label: t.availableChallenges || "Browse Challenges",
                    onClick: () => setSelectedTab("available"),
                  }}
                />
              ) : (
                activeChallenges.map((challenge) => {
                  const progressPercent = getProgressPercent(challenge);
                  const badge = challenge.reward
                    ? getBadgeById(challenge.reward)
                    : undefined;

                  return (
                    <div
                      key={challenge.id}
                      className="bg-secondary rounded-2xl p-4 zen-shadow-card hover:zen-shadow-hover motion-safe:transition-all"
                    >
                      <div className="flex items-start gap-4">
                        <div className="text-4xl">{challenge.icon}</div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="font-semibold text-foreground">
                                {challenge.title[language]}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {challenge.description[language]}
                              </p>
                            </div>
                            <span className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary font-medium">
                              {getChallengeTypeLabel(challenge.type)}
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="mt-3 mb-2">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-muted-foreground">
                                {t.progress || "Progress"}
                              </span>
                              <span className="font-semibold text-foreground">
                                {challenge.progress} / {challenge.target}
                              </span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full zen-gradient motion-safe:transition-all motion-safe:duration-500"
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          </div>

                          {/* Reward Badge */}
                          {badge && (
                            <div className="flex items-center gap-2 mt-3 p-2 bg-card rounded-xl">
                              <EmojiOrIcon
                                emoji={badge.icon}
                                iconName={badge.iconName}
                                size="md"
                              />
                              <div className="flex-1">
                                <p className="text-xs text-muted-foreground">
                                  {t.reward || "Reward"}
                                </p>
                                <p
                                  className={`text-sm font-semibold ${getRarityColor(badge.rarity)}`}
                                >
                                  {badge.title[language]}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* Available Challenges Tab */}
          {selectedTab === "available" && (
            <>
              {challengeTemplates.map((template, index) => {
                const isActive = isTemplateActive(index);
                const badge = template.reward
                  ? getBadgeById(template.reward)
                  : undefined;

                return (
                  <div
                    key={`${template.type}-${template.target}`}
                    className={`bg-secondary rounded-2xl p-4 zen-shadow-card motion-safe:transition-all ${
                      isActive ? "opacity-50" : "hover:zen-shadow-hover"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-4xl">{template.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-foreground">
                              {template.title[language]}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {template.description[language]}
                            </p>
                          </div>
                          <span className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary font-medium">
                            {getChallengeTypeLabel(template.type)}
                          </span>
                        </div>

                        {/* Target */}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                          <Target className="w-4 h-4" />
                          <span>
                            {t.target || "Target"}:{" "}
                            <span className="font-semibold text-foreground">
                              {template.target}
                            </span>
                          </span>
                        </div>

                        {/* Reward Badge */}
                        {badge && (
                          <div className="flex items-center gap-2 mb-3 p-2 bg-card rounded-xl">
                            <EmojiOrIcon
                              emoji={badge.icon}
                              iconName={badge.iconName}
                              size="md"
                            />
                            <div className="flex-1">
                              <p className="text-xs text-muted-foreground">
                                {t.reward || "Reward"}
                              </p>
                              <p
                                className={`text-sm font-semibold ${getRarityColor(badge.rarity)}`}
                              >
                                {badge.title[language]}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Start Button */}
                        <button
                          onClick={() => {
                            if (!isActive) {
                              const newChallenge =
                                createChallengeFromTemplate(index);
                              onStartChallenge(newChallenge);
                            }
                          }}
                          disabled={isActive}
                          className={`w-full py-2 rounded-xl font-medium motion-safe:transition-all ${
                            isActive
                              ? "bg-muted text-muted-foreground cursor-not-allowed"
                              : "bg-primary text-primary-foreground hover:opacity-90 zen-shadow"
                          }`}
                        >
                          {isActive ? (
                            <span className="flex items-center justify-center gap-2">
                              <CheckCircle2 className="w-4 h-4" />
                              {t.challengeActive || "Active"}
                            </span>
                          ) : (
                            <span className="flex items-center justify-center gap-2">
                              <Plus className="w-4 h-4" />
                              {t.startChallenge || "Start Challenge"}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* Badges Tab */}
          {selectedTab === "badges" && (
            <>
              {shouldVirtualize(badges.length) ? (
                <VirtualGrid
                  items={badges}
                  columns={2}
                  itemHeight={180}
                  gap={12}
                  containerClassName="h-full"
                  getItemKey={(badge) => badge.id}
                  renderItem={(badge) => (
                    <BadgeCard
                      badge={badge}
                      language={language}
                      t={t as unknown as Record<string, string>}
                      onShare={handleShareBadge}
                      virtual
                    />
                  )}
                />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {badges.map((badge) => (
                    <BadgeCard
                      key={badge.id}
                      badge={badge}
                      language={language}
                      t={t as unknown as Record<string, string>}
                      onShare={handleShareBadge}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Badge Share Modal */}
      {selectedBadge && (
        <UnifiedShareModal
          open={showShareModal}
          onOpenChange={setShowShareModal}
          mode="achievement"
          badge={selectedBadge}
        />
      )}
    </div>
  );
}

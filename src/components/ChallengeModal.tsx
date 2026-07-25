/**
 * ChallengeModal - Modal for creating and managing friend challenges
 * Part of v1.4.0 Social & Sharing
 */

import { useState, useEffect, memo } from "react";
import { ChevronRight, Users } from "lucide-react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { shouldAnimate, zenTap, zenHover } from "@/lib/animationUtils";
import { useLanguage } from "@/contexts/LanguageContext";
import { hapticTap } from "@/lib/haptics";
import { useBackHandler } from "@/hooks/useBackHandler";
import { Habit } from "@/types";
import { Challenge, ChallengeInvite } from "@/lib/friendChallenge";
import { CreateChallengeView } from "./challenges/CreateChallengeView";
import { ChallengesListView } from "./challenges/ChallengesListView";
import { JoinChallengeView } from "./challenges/JoinChallengeView";
import { ChallengeDetailsView } from "./challenges/ChallengeDetailsView";

// ============================================
// TYPES
// ============================================

type ModalMode = "create" | "list" | "details" | "join";

interface ChallengeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit?: Habit; // If provided, opens in create mode for this habit
  username?: string;
  initialInvite?: ChallengeInvite; // If provided, opens in join mode with pre-filled data
}

// ============================================
// MAIN COMPONENT
// ============================================

export const ChallengeModal = memo(function ChallengeModal({
  open,
  onOpenChange,
  habit,
  username,
  initialInvite,
}: ChallengeModalProps) {
  const { t } = useLanguage();

  const [mode, setMode] = useState<ModalMode>(habit ? "create" : "list");
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(
    null,
  );
  const [newlyCreatedChallenge, setNewlyCreatedChallenge] =
    useState<Challenge | null>(null);
  const [pendingInvite, setPendingInvite] = useState<
    ChallengeInvite | undefined
  >(undefined);

  // Android back button: navigate sub-views back, or close modal from list view
  useBackHandler(open, () => {
    void hapticTap();
    if (mode === "details" || mode === "join" || mode === "create") {
      setSelectedChallenge(null);
      setNewlyCreatedChallenge(null);
      setPendingInvite(undefined);
      setMode("list");
    } else {
      onOpenChange(false);
    }
  });

  // Escape key: navigate sub-views back, or close the modal
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (mode === "details" || mode === "join" || mode === "create") {
          setSelectedChallenge(null);
          setNewlyCreatedChallenge(null);
          setPendingInvite(undefined);
          setMode("list");
        } else {
          onOpenChange(false);
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, mode, onOpenChange]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      // If we have an invite, go to join mode
      if (initialInvite) {
        setPendingInvite(initialInvite);
        setMode("join");
      } else {
        setPendingInvite(undefined);
        setMode(habit ? "create" : "list");
      }
      setSelectedChallenge(null);
      setNewlyCreatedChallenge(null);
    }
  }, [open, habit, initialInvite]);

  const handleChallengeCreated = (challenge: Challenge) => {
    setNewlyCreatedChallenge(challenge);
    setSelectedChallenge(challenge);
    setMode("details");
  };

  const handleChallengeJoined = (challenge: Challenge) => {
    setSelectedChallenge(challenge);
    setPendingInvite(undefined);
    setMode("details");
  };

  const handleSelectChallenge = (challenge: Challenge) => {
    void hapticTap();
    setSelectedChallenge(challenge);
    setMode("details");
  };

  const handleJoinMode = () => {
    void hapticTap();
    setPendingInvite(undefined);
    setMode("join");
  };

  const handleBack = () => {
    void hapticTap();
    setSelectedChallenge(null);
    setNewlyCreatedChallenge(null);
    setPendingInvite(undefined);
    setMode("list");
  };

  const getTitle = (): string => {
    switch (mode) {
      case "create":
        return t.createChallenge || "Create Challenge";
      case "join":
        return t.joinChallenge || "Join Challenge";
      case "details":
        return newlyCreatedChallenge
          ? t.challengeCreated || "Challenge Created!"
          : t.challengeDetails || "Challenge Details";
      default:
        return t.friendChallenges || "Friend Challenges";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85dvh] flex flex-col p-0 gap-0 rounded-2xl">
        {/* Visually hidden title for accessibility */}
        <DialogTitle className="sr-only">{getTitle()}</DialogTitle>

        {/* Premium Header - like AICoachChat */}
        <div className="flex min-w-0 items-center justify-between p-4 border-b border-slate-200/60 dark:border-white/10 relative">
          {/* Subtle gradient glow */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[rgba(139,92,246,0.05)] to-transparent" />

          <div className="flex min-w-0 flex-1 items-center gap-3 relative z-10">
            {(mode === "details" || mode === "join") && (
              <motion.button
                onClick={handleBack}
                aria-label={t.back || "Go back"}
                className="min-h-11 min-w-11 shrink-0 p-2 rounded-xl bg-slate-100/60 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-200/60 dark:hover:bg-white/10 motion-safe:transition-colors"
                whileHover={zenHover.glow}
                whileTap={zenTap.icon}
              >
                <ChevronRight className="w-5 h-5 rotate-180 rtl:scale-x-[-1]" />
              </motion.button>
            )}

            <motion.div
              className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center bg-gradient-to-br from-[rgba(139,92,246,0.5)] to-[rgba(168,85,247,0.4)] shadow-[0_0_15px_rgba(139,92,246,0.3)]"
              animate={shouldAnimate() ? { scale: [1, 1.05, 1] } : undefined}
              transition={
                shouldAnimate()
                  ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
                  : undefined
              }
            >
              <Users className="w-5 h-5 text-white" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <h2 className="min-w-0 break-words font-semibold text-slate-800 dark:text-white [hyphens:manual] [overflow-wrap:break-word]">
                {getTitle()}
              </h2>
              <p className="min-w-0 break-words text-xs text-slate-500 dark:text-white/60 [hyphens:manual] [overflow-wrap:break-word]">
                {mode === "create"
                  ? t.challengeDescription || "Challenge friends"
                  : mode === "join"
                    ? t.enterCodeToJoin || "Enter code to join"
                    : t.trackWithFriends || "Track with friends"}
              </p>
            </div>
          </div>
        </div>

        {/* Content - flex-1 with its own padding */}
        <div className="flex-1 overflow-y-auto p-4 bg-[radial-gradient(ellipse_at_bottom,rgba(139,92,246,0.03)_0%,transparent_50%)]">
          {mode === "create" && habit && (
            <CreateChallengeView
              habit={habit}
              username={username}
              onCreated={handleChallengeCreated}
              t={t}
            />
          )}

          {mode === "list" && (
            <ChallengesListView
              onSelectChallenge={handleSelectChallenge}
              onJoinChallenge={handleJoinMode}
              t={t}
            />
          )}

          {mode === "join" && (
            <JoinChallengeView
              initialInvite={pendingInvite}
              onJoined={handleChallengeJoined}
              onCancel={handleBack}
              t={t}
            />
          )}

          {mode === "details" && selectedChallenge && (
            <ChallengeDetailsView
              challenge={selectedChallenge}
              onBack={handleBack}
              onDelete={handleBack}
              t={t}
              username={username}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

export default ChallengeModal;

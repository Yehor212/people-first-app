/**
 * ChallengeModal - Modal for creating and managing friend challenges
 * Part of v1.4.0 Social & Sharing
 */

import { useCallback, useState, useEffect, memo } from "react";
import { ChevronRight, Users } from "lucide-react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
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
  onOpenFriends?: () => void;
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
  onOpenFriends,
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

  const returnToList = useCallback(() => {
    setSelectedChallenge(null);
    setNewlyCreatedChallenge(null);
    setPendingInvite(undefined);
    setMode("list");
  }, []);

  const unwindOrClose = useCallback(() => {
    if (mode === "details" || mode === "join" || mode === "create") {
      returnToList();
      return;
    }
    onOpenChange(false);
  }, [mode, onOpenChange, returnToList]);

  // Android back button: navigate sub-views back, or close modal from list view
  useBackHandler(open, () => {
    void hapticTap();
    unwindOrClose();
  });

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
    returnToList();
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

  const getDescription = (): string => {
    if (mode === "create") {
      return t.challengeDescription || "Challenge friends";
    }
    if (mode === "join") {
      return t.enterCodeToJoin || "Enter code to join";
    }
    return t.trackWithFriends || "Track with friends";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85dvh] max-w-lg flex flex-col gap-0 overflow-hidden rounded-2xl p-0"
        data-testid="challenge-modal"
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          unwindOrClose();
        }}
      >
        {/* Visually hidden title for accessibility */}
        <DialogTitle className="sr-only">{getTitle()}</DialogTitle>
        <DialogDescription className="sr-only">{getDescription()}</DialogDescription>

        {/* Premium Header - like AICoachChat */}
        <div className="relative flex min-h-[64px] min-w-0 shrink-0 items-center justify-between border-b border-slate-200/60 p-[16px] pe-[64px] dark:border-white/10">
          {/* Subtle gradient glow */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[rgba(139,92,246,0.05)] to-transparent" />

          <div className="relative z-10 flex min-w-0 flex-1 items-center gap-[12px]">
            {(mode === "details" || mode === "join") && (
              <motion.button
                onClick={handleBack}
                aria-label={t.back || "Go back"}
                data-testid="challenge-modal-back"
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-slate-200/60 bg-slate-100/60 p-[8px] text-slate-600 motion-safe:transition-colors hover:bg-slate-200/60 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                whileHover={zenHover.glow}
                whileTap={zenTap.icon}
              >
              <ChevronRight className="h-[20px] w-[20px] rotate-180 rtl:scale-x-[-1]" />
              </motion.button>
            )}

            <motion.div
              className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[rgba(139,92,246,0.5)] to-[rgba(168,85,247,0.4)] shadow-[0_0_15px_rgba(139,92,246,0.3)] max-[359px]:hidden"
              animate={shouldAnimate() ? { scale: [1, 1.05, 1] } : undefined}
              transition={
                shouldAnimate()
                  ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
                  : undefined
              }
            >
              <Users className="h-[20px] w-[20px] text-white" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <h2 className="min-w-0 break-words font-semibold leading-snug text-slate-800 [hyphens:auto] [overflow-wrap:break-word] dark:text-white">
                {getTitle()}
              </h2>
              <p className="min-w-0 break-words text-xs text-slate-500 dark:text-white/60 [hyphens:auto] [overflow-wrap:break-word] max-[359px]:hidden">
                {getDescription()}
              </p>
            </div>
          </div>
        </div>

        {/* Content - flex-1 with its own padding */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_bottom,rgba(139,92,246,0.03)_0%,transparent_50%)] p-[16px]">
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
              onOpenFriends={onOpenFriends}
              t={t}
            />
          )}

          {mode === "join" && (
            <JoinChallengeView
              initialInvite={pendingInvite}
              username={username}
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

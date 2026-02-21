/**
 * ChallengeModal - Modal for creating and managing friend challenges
 * Part of v1.4.0 Social & Sharing
 */

import { useState, useEffect, memo } from 'react';
import { ChevronRight, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticTap } from '@/lib/haptics';
import { useBackHandler } from '@/hooks/useBackHandler';
import { Habit } from '@/types';
import { Challenge, ChallengeInvite } from '@/lib/friendChallenge';
import { CreateChallengeView } from './challenges/CreateChallengeView';
import { ChallengesListView } from './challenges/ChallengesListView';
import { JoinChallengeView } from './challenges/JoinChallengeView';
import { ChallengeDetailsView } from './challenges/ChallengeDetailsView';

// ============================================
// TYPES
// ============================================

type ModalMode = 'create' | 'list' | 'details' | 'join';

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

  const [mode, setMode] = useState<ModalMode>(habit ? 'create' : 'list');
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [newlyCreatedChallenge, setNewlyCreatedChallenge] = useState<Challenge | null>(null);
  const [pendingInvite, setPendingInvite] = useState<ChallengeInvite | undefined>(undefined);

  // Android back button: navigate sub-views before closing entire modal
  useBackHandler(open && (mode === 'details' || mode === 'join' || mode === 'create'), () => {
    void hapticTap();
    setSelectedChallenge(null);
    setNewlyCreatedChallenge(null);
    setPendingInvite(undefined);
    setMode('list');
  });

  // Escape key: navigate sub-views back, or close the modal
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (mode === 'details' || mode === 'join' || mode === 'create') {
          setSelectedChallenge(null);
          setNewlyCreatedChallenge(null);
          setPendingInvite(undefined);
          setMode('list');
        } else {
          onOpenChange(false);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, mode, onOpenChange]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      // If we have an invite, go to join mode
      if (initialInvite) {
        setPendingInvite(initialInvite);
        setMode('join');
      } else {
        setPendingInvite(undefined);
        setMode(habit ? 'create' : 'list');
      }
      setSelectedChallenge(null);
      setNewlyCreatedChallenge(null);
    }
  }, [open, habit, initialInvite]);

  const handleChallengeCreated = (challenge: Challenge) => {
    setNewlyCreatedChallenge(challenge);
    setSelectedChallenge(challenge);
    setMode('details');
  };

  const handleChallengeJoined = (challenge: Challenge) => {
    setSelectedChallenge(challenge);
    setPendingInvite(undefined);
    setMode('details');
  };

  const handleSelectChallenge = (challenge: Challenge) => {
    void hapticTap();
    setSelectedChallenge(challenge);
    setMode('details');
  };

  const handleJoinMode = () => {
    void hapticTap();
    setPendingInvite(undefined);
    setMode('join');
  };

  const handleBack = () => {
    void hapticTap();
    setSelectedChallenge(null);
    setNewlyCreatedChallenge(null);
    setPendingInvite(undefined);
    setMode('list');
  };

  const getTitle = (): string => {
    switch (mode) {
      case 'create':
        return t.createChallenge || 'Create Challenge';
      case 'join':
        return t.joinChallenge || 'Join Challenge';
      case 'details':
        return newlyCreatedChallenge
          ? t.challengeCreated || 'Challenge Created!'
          : t.challengeDetails || 'Challenge Details';
      default:
        return t.friendChallenges || 'Friend Challenges';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85dvh] flex flex-col p-0 gap-0 rounded-2xl">
        {/* Visually hidden title for accessibility */}
        <DialogTitle className="sr-only">{getTitle()}</DialogTitle>

        {/* Premium Header - like AICoachChat */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200/60 dark:border-white/10 relative">
          {/* Subtle gradient glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.05) 0%, transparent 100%)'
            }}
          />

          <div className="flex items-center gap-3 relative z-10">
            {(mode === 'details' || mode === 'join') && (
              <motion.button
                onClick={handleBack}
                aria-label={t.back || 'Go back'}
                className="p-2 rounded-xl bg-slate-100/60 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </motion.button>
            )}

            <motion.div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.5) 0%, rgba(168, 85, 247, 0.4) 100%)',
                boxShadow: '0 0 15px rgba(139, 92, 246, 0.3)'
              }}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Users className="w-5 h-5 text-white" />
            </motion.div>

            <div>
              <h2 className="font-semibold text-slate-800 dark:text-white">
                {getTitle()}
              </h2>
              <p className="text-xs text-slate-500 dark:text-white/60">
                {mode === 'create'
                  ? t.challengeDescription || 'Challenge friends'
                  : mode === 'join'
                    ? t.enterCodeToJoin || 'Enter code to join'
                    : t.trackWithFriends || 'Track with friends'}
              </p>
            </div>
          </div>
        </div>

        {/* Content - flex-1 with its own padding */}
        <div
          className="flex-1 overflow-y-auto p-4"
          style={{
            background: 'radial-gradient(ellipse at bottom, rgba(139, 92, 246, 0.03) 0%, transparent 50%)'
          }}
        >
          {mode === 'create' && habit && (
            <CreateChallengeView
              habit={habit}
              username={username}
              onCreated={handleChallengeCreated}
              t={t}
            />
          )}

          {mode === 'list' && (
            <ChallengesListView
              onSelectChallenge={handleSelectChallenge}
              onJoinChallenge={handleJoinMode}
              t={t}
            />
          )}

          {mode === 'join' && (
            <JoinChallengeView
              initialInvite={pendingInvite}
              onJoined={handleChallengeJoined}
              onCancel={handleBack}
              t={t}
            />
          )}

          {mode === 'details' && selectedChallenge && (
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

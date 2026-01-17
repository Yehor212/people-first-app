/**
 * CompanionPanel - Interactive companion mascot panel
 * Allows users to interact with, rename, and customize their companion
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit3, Check, Heart, Sparkles, Star, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { Companion, CompanionType, CompanionMood } from '@/types';
import { COMPANION_EMOJIS } from '@/lib/innerWorldConstants';

interface CompanionPanelProps {
  companion: Companion;
  isOpen: boolean;
  onClose: () => void;
  onRename: (name: string) => void;
  onChangeType: (type: CompanionType) => void;
  streak: number;
}

const COMPANION_TYPES: CompanionType[] = ['fox', 'cat', 'owl', 'rabbit', 'dragon'];

const COMPANION_NAMES: Record<CompanionType, { default: string; personality: string }> = {
  fox: { default: 'Луна', personality: 'Curious & Playful' },
  cat: { default: 'Мурка', personality: 'Calm & Wise' },
  owl: { default: 'Сова', personality: 'Thoughtful & Patient' },
  rabbit: { default: 'Зайка', personality: 'Energetic & Kind' },
  dragon: { default: 'Дракоша', personality: 'Brave & Loyal' },
};

const MOOD_MESSAGES: Record<CompanionMood, string[]> = {
  sleeping: [
    'Zzz... 💤',
    '*мирно спит*',
    '😴',
  ],
  calm: [
    'Привет! Как ты?',
    'Рад тебя видеть!',
    'Давай вместе сегодня!',
  ],
  happy: [
    'Ты молодец! 💫',
    'Отличная работа!',
    'Так держать! ✨',
  ],
  excited: [
    'ВАУ! Круто! 🎉',
    'Ты супер!',
    'Невероятно! 🌟',
  ],
  celebrating: [
    'ПОЗДРАВЛЯЮ! 🎊',
    'Ты легенда! 🏆',
    'Фантастика! 🎉',
  ],
  supportive: [
    'Я скучал 💝',
    'С возвращением!',
    'Рад, что ты здесь!',
  ],
};

function getRandomMessage(mood: CompanionMood): string {
  const messages = MOOD_MESSAGES[mood];
  return messages[Math.floor(Math.random() * messages.length)];
}

export function CompanionPanel({
  companion,
  isOpen,
  onClose,
  onRename,
  onChangeType,
  streak,
}: CompanionPanelProps) {
  const { t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(companion.name);
  const [message, setMessage] = useState(() => getRandomMessage(companion.mood));

  const handleSaveName = () => {
    if (editName.trim()) {
      onRename(editName.trim());
      setIsEditing(false);
    }
  };

  const handleTypeChange = (type: CompanionType) => {
    onChangeType(type);
    setMessage(getRandomMessage(companion.mood));
  };

  // Calculate XP progress
  const xpForNextLevel = companion.level * 100;
  const xpProgress = (companion.experience / xpForNextLevel) * 100;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-lg bg-gradient-to-b from-primary/10 to-background rounded-t-3xl max-h-[85vh] overflow-hidden"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with close button */}
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <h2 className="text-lg font-semibold">{t.myCompanion || 'My Companion'}</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(85vh-60px)]">
              {/* Companion display */}
              <div className="text-center mb-6">
                {/* Speech bubble */}
                <motion.div
                  className="inline-block relative mb-4"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, type: 'spring' }}
                >
                  <div className="bg-muted px-4 py-2 rounded-2xl relative">
                    <p className="text-sm font-medium">{message}</p>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-muted rotate-45" />
                  </div>
                </motion.div>

                {/* Big companion emoji */}
                <motion.div
                  className="text-8xl mb-4"
                  animate={{
                    y: [0, -10, 0],
                    rotate: [-2, 2, -2],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  {COMPANION_EMOJIS[companion.type]}
                </motion.div>

                {/* Name with edit */}
                <div className="flex items-center justify-center gap-2 mb-2">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="px-3 py-1 rounded-lg bg-muted border border-border text-center font-medium"
                        maxLength={20}
                        autoFocus
                      />
                      <button
                        onClick={handleSaveName}
                        className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-2xl font-bold">{companion.name}</h3>
                      <button
                        onClick={() => {
                          setEditName(companion.name);
                          setIsEditing(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      >
                        <Edit3 className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </>
                  )}
                </div>

                {/* Personality */}
                <p className="text-sm text-muted-foreground">
                  {COMPANION_NAMES[companion.type].personality}
                </p>
              </div>

              {/* Level and XP */}
              <div className="bg-muted/50 rounded-2xl p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500" />
                    <span className="font-semibold">Level {companion.level}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {companion.experience}/{xpForNextLevel} XP
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary to-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${xpProgress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <Heart className="w-5 h-5 mx-auto mb-1 text-red-400" />
                  <p className="text-lg font-bold">{companion.personality.warmth}%</p>
                  <p className="text-xs text-muted-foreground">{t.warmth || 'Warmth'}</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <Sparkles className="w-5 h-5 mx-auto mb-1 text-yellow-400" />
                  <p className="text-lg font-bold">{companion.personality.energy}%</p>
                  <p className="text-xs text-muted-foreground">{t.energy || 'Energy'}</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <MessageCircle className="w-5 h-5 mx-auto mb-1 text-blue-400" />
                  <p className="text-lg font-bold">{companion.personality.wisdom}%</p>
                  <p className="text-xs text-muted-foreground">{t.wisdom || 'Wisdom'}</p>
                </div>
              </div>

              {/* Streak display */}
              {streak > 0 && (
                <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-2xl p-4 mb-6 text-center">
                  <p className="text-3xl mb-1">🔥 {streak}</p>
                  <p className="text-sm font-medium">{t.companionStreak || 'Day Streak!'}</p>
                </div>
              )}

              {/* Companion selector */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                  {t.chooseCompanion || 'Choose Companion'}
                </h4>
                <div className="flex justify-center gap-2">
                  {COMPANION_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => handleTypeChange(type)}
                      className={cn(
                        "p-3 rounded-xl text-3xl transition-all",
                        companion.type === type
                          ? "bg-primary/20 ring-2 ring-primary scale-110"
                          : "bg-muted hover:bg-muted/80 hover:scale-105"
                      )}
                    >
                      {COMPANION_EMOJIS[type]}
                    </button>
                  ))}
                </div>
              </div>

              {/* How to level up hint */}
              <div className="text-center text-xs text-muted-foreground">
                <p>💡 {t.levelUpHint || 'Complete activities to earn XP and level up!'}</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

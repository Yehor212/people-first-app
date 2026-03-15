/**
 * SelectedDayPanel — Premium cosmic selected day details
 * Pure component, 0 useState.
 */

import { motion } from 'framer-motion';
import { Calendar, Heart, Brain, Target, Sparkles } from 'lucide-react';
import { MoodEntry, Habit, GratitudeEntry } from '@/types';
import { AnimatedEmotionEmoji } from '@/components/AnimatedEmotionEmoji';
import { MOOD_TO_EMOTION_MAP } from '@/lib/emotionConstants';
import type { Language } from '@/i18n/translations';
import { getLocale } from '@/lib/timeUtils';

interface SelectedDayData {
  moods: MoodEntry[];
  mood: MoodEntry | undefined;
  focusMinutes: number;
  habits: string[];
  gratitude: GratitudeEntry[];
}

interface SelectedDayPanelProps {
  selectedDate: string | null;
  selectedDayData: SelectedDayData | null;
  habits: Habit[];
  emotionLabels: Record<string, string>;
  t: Record<string, string>;
  language: string;
}

// Helper to get time of day label from timestamp
function getTimeOfDay(timestamp: number | undefined, t: Record<string, string>): string {
  if (!timestamp) return '';
  const hour = new Date(timestamp).getHours();
  if (hour < 12) return t.morning || 'Morning';
  if (hour < 18) return t.afternoon || 'Afternoon';
  return t.evening || 'Evening';
}

function getTimeOfDayEmoji(timestamp: number | undefined): string {
  if (!timestamp) return '📝';
  const hour = new Date(timestamp).getHours();
  if (hour < 12) return '🌅';
  if (hour < 18) return '☀️';
  return '🌙';
}

export function SelectedDayPanel({
  selectedDate, selectedDayData, habits, emotionLabels, t, language,
}: SelectedDayPanelProps) {
  return (
    <motion.div
      className="mt-5 relative overflow-hidden rounded-2xl border border-violet-500/20 shadow-[0_0_30px_rgba(139,92,246,0.15),inset_0_1px_0_rgba(255,255,255,0.05)]"
      style={{
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.08) 50%, rgba(6, 182, 212, 0.1) 100%)',
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Animated nebula background */}
      <motion.div
        className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_70%_30%,rgba(139,92,246,0.15)_0%,transparent_50%)]"
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_80%,rgba(6,182,212,0.1)_0%,transparent_40%)]"
        animate={{ opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
      />

      {selectedDate && selectedDayData ? (
        <div className="relative">
          {/* Premium Header */}
          <div className="flex items-center justify-between p-4 border-b border-foreground/10">
            <div className="flex items-center gap-3">
              <motion.div
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-[linear-gradient(135deg,rgba(139,92,246,0.3),rgba(59,130,246,0.2))] shadow-[0_0_15px_rgba(139,92,246,0.4)]"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Calendar className="w-5 h-5 text-violet-600 dark:text-violet-300" />
              </motion.div>
              <div>
                <p className="font-bold text-lg text-foreground">{new Date(selectedDate + 'T00:00:00').toLocaleDateString(getLocale(language as Language), { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString(getLocale(language as Language), { weekday: 'long' })}
                </p>
              </div>
            </div>
            {selectedDayData.mood && (
              <motion.div
                className="drop-shadow-[0_0_12px_rgba(139,92,246,0.6)]"
                animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <AnimatedEmotionEmoji
                  emotion={selectedDayData.mood.emotion?.primary || MOOD_TO_EMOTION_MAP[selectedDayData.mood.mood]}
                  size="lg"
                />
              </motion.div>
            )}
          </div>

          {/* Premium Stats Grid */}
          <div className="grid grid-cols-2 gap-3 p-4">
            {[
              {
                icon: Heart,
                label: t.moodToday,
                value: selectedDayData.mood
                  ? emotionLabels[selectedDayData.mood.emotion?.primary || MOOD_TO_EMOTION_MAP[selectedDayData.mood.mood]]
                  : '—',
                color: '#ec4899'
              },
              {
                icon: Brain,
                label: t.focusMinutes,
                value: `${selectedDayData.focusMinutes}m`,
                color: '#3b82f6'
              },
              {
                icon: Target,
                label: t.habitsCompleted,
                value: selectedDayData.habits.length,
                color: '#22c55e'
              },
              {
                icon: Sparkles,
                label: t.gratitudes,
                value: selectedDayData.gratitude.length,
                color: '#f59e0b'
              },
            ].map((stat, i) => (
              <motion.div
                key={i}
                className="p-3 rounded-xl bg-black/5 dark:bg-white/5 backdrop-blur-sm border border-black/10 dark:border-white/10"
                style={{ boxShadow: `0 0 10px ${stat.color}20` }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.02, borderColor: `${stat.color}40` }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <p className="text-lg font-bold text-foreground">{stat.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Mood Journey Timeline */}
          {selectedDayData.moods.length > 0 && (
            <div className="px-4 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 bg-gradient-to-b from-violet-500 to-cyan-500 rounded-full" />
                <span className="text-sm font-medium text-foreground/80">{t.moodNotes || 'Mood Journey'}</span>
              </div>

              <div className="space-y-3">
                {selectedDayData.moods.map((entry, idx) => {
                  const mappedEmotion = entry.emotion?.primary || MOOD_TO_EMOTION_MAP[entry.mood];
                  const emotionColor = {
                    joy: '#fbbf24', trust: '#22c55e', fear: '#6366f1', surprise: '#f97316',
                    sadness: '#3b82f6', disgust: '#a855f7', anger: '#ef4444', anticipation: '#ec4899'
                  }[mappedEmotion] || '#9ca3af';

                  return (
                    <motion.div
                      key={entry.id || `mood-${idx}`}
                      className="relative ps-6"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                    >
                      {/* Timeline line */}
                      {idx < selectedDayData.moods.length - 1 && (
                        <div className="absolute start-[9px] top-6 bottom-0 w-px bg-gradient-to-b from-violet-500/50 to-cyan-500/30" />
                      )}
                      {/* Timeline dot */}
                      <motion.div
                        className="absolute start-0 top-3 w-5 h-5 rounded-full border-2"
                        style={{
                          borderColor: emotionColor,
                          background: `radial-gradient(circle, ${emotionColor}40, transparent)`,
                          boxShadow: `0 0 10px ${emotionColor}60`,
                        }}
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity, delay: idx * 0.2 }}
                      />
                      {/* Entry card */}
                      <div className="ms-4 p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                        <div className="flex items-center gap-2">
                          <AnimatedEmotionEmoji
                            emotion={mappedEmotion}
                            size="sm"
                          />
                          <span className="font-medium text-foreground">
                            {emotionLabels[mappedEmotion]}
                          </span>
                          <span className="ms-auto text-xs text-muted-foreground flex items-center gap-1">
                            {getTimeOfDayEmoji(entry.timestamp)} {getTimeOfDay(entry.timestamp, t)}
                          </span>
                        </div>
                        {entry.note && (
                          <p className="mt-2 text-sm text-foreground/70 italic ps-6">"{entry.note}"</p>
                        )}
                        {entry.tags && entry.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2 ps-6">
                            {entry.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 text-xs rounded-full bg-violet-500/20 text-violet-700 dark:text-violet-300 shadow-[0_0_6px_rgba(139,92,246,0.3)]"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* State of Mind: emotion tags */}
                        {entry.emotionTags && entry.emotionTags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2 ps-6">
                            {entry.emotionTags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 text-xs rounded-full bg-primary/15 text-primary dark:text-primary"
                              >
                                {t[`somTag${tag.charAt(0).toUpperCase()}${tag.slice(1)}`] || tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* State of Mind: life contexts */}
                        {entry.contexts && entry.contexts.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1 ps-6">
                            {entry.contexts.map((ctx) => (
                              <span
                                key={ctx}
                                className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground"
                              >
                                {t[`somCtx${ctx.charAt(0).toUpperCase()}${ctx.slice(1)}`] || ctx}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Habits Details */}
          {habits.length > 0 && (
            <motion.div
              className="mx-4 mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  {t.habitsCompleted} ({selectedDayData.habits.length}/{habits.length})
                </span>
              </div>

              {/* Completed habits */}
              {selectedDayData.habits.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedDayData.habits.map((habitId, idx) => {
                    const habit = habits.find(h => h.id === habitId);
                    return (
                      <motion.div
                        key={habitId}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 rounded-full"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <span className="text-sm">{habit?.icon || '✓'}</span>
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{habit?.name || habitId}</span>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Missed habits */}
              {(() => {
                const missedHabits = habits.filter(h => !selectedDayData.habits.includes(h.id));
                if (missedHabits.length === 0) return null;
                return (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-emerald-500/20">
                    {missedHabits.map((habit, idx) => (
                      <motion.div
                        key={habit.id}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 rounded-full"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <span className="text-sm opacity-50">{habit.icon}</span>
                        <span className="text-xs font-medium text-red-700 dark:text-red-300">{habit.name}</span>
                      </motion.div>
                    ))}
                  </div>
                );
              })()}
            </motion.div>
          )}

          {/* Gratitude entries with premium styling */}
          {selectedDayData.gratitude.length > 0 && (
            <div className="px-4 pb-4 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <motion.div
                  animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </motion.div>
                <span className="text-sm font-medium text-amber-700/80 dark:text-amber-300/80">{t.gratitude || 'Gratitude'}</span>
              </div>
              {selectedDayData.gratitude.map((entry, idx) => (
                <motion.div
                  key={entry.id}
                  className="p-3 rounded-xl border border-amber-500/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.1)_0%,rgba(249,115,22,0.05)_100%)] shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <div className="flex items-start gap-2">
                    <motion.span
                      className="text-base flex-shrink-0"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity, delay: idx * 0.3 }}
                    >
                      ✨
                    </motion.span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{entry.text}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(entry.timestamp).toLocaleTimeString(getLocale(language as Language), { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 text-center">
          <motion.div
            className="inline-block mb-3"
            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Calendar className="w-8 h-8 text-violet-400/50" />
          </motion.div>
          <p className="text-sm text-muted-foreground">{t.calendarSelectDay}</p>
        </div>
      )}
    </motion.div>
  );
}

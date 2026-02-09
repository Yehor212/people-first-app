/**
 * EmotionGuide - Helps users understand which emotion to choose
 * Maps everyday feelings (tired, stressed, bored...) to Plutchik's 8 emotions
 */

import { PrimaryEmotion } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { AnimatedEmotionEmoji } from '@/components/AnimatedEmotionEmoji';
import {
  EMOTION_ORDER,
  SECONDARY_EMOTIONS,
  INTENSITY_EMOJIS,
  getEmotionColor,
  getEmotionTranslations,
  getEmotionGuide,
} from '@/lib/emotionConstants';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface EmotionGuideProps {
  onSelectEmotion: (emotion: PrimaryEmotion) => void;
  onBack: () => void;
}

export function EmotionGuide({ onSelectEmotion }: EmotionGuideProps) {
  const { language } = useLanguage();
  const guide = getEmotionGuide(language);
  const emotionT = getEmotionTranslations(language);

  return (
    <div className="space-y-3">
      {/* Subtitle */}
      <p className="text-sm text-muted-foreground text-center">
        {guide.subtitle}
      </p>

      {/* Emotion cards */}
      <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1 -mr-1 overscroll-contain touch-pan-y">
        {EMOTION_ORDER.map((emotion, index) => {
          const entry = guide.emotions[emotion];
          const color = getEmotionColor(emotion, 'moderate');
          const secondary = SECONDARY_EMOTIONS[emotion];

          return (
            <motion.button
              key={emotion}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onSelectEmotion(emotion)}
              className={cn(
                "w-full text-left rounded-xl p-3 transition-all",
                "bg-secondary/40 hover:bg-secondary/70 active:scale-[0.98]",
                "border-l-[3px]"
              )}
              style={{ borderLeftColor: color }}
            >
              {/* Header row */}
              <div className="flex items-center gap-2.5 mb-2">
                <AnimatedEmotionEmoji emotion={emotion} size="md" />
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-foreground">
                    {emotionT[emotion]}
                  </span>
                  <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                    {entry.description}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </div>

              {/* Common feelings chips */}
              <div className="mb-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                  {guide.chooseWhen}
                </p>
                <div className="flex flex-wrap gap-1">
                  {entry.feelings.map((feeling) => (
                    <span
                      key={feeling}
                      className="px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: color + '18',
                        color: color,
                      }}
                    >
                      {feeling}
                    </span>
                  ))}
                </div>
              </div>

              {/* Intensity levels */}
              <div className="flex gap-3 text-[11px] text-muted-foreground">
                <span>{INTENSITY_EMOJIS.mild} {emotionT[secondary.mild]}</span>
                <span>{INTENSITY_EMOJIS.moderate} {emotionT[secondary.moderate]}</span>
                <span>{INTENSITY_EMOJIS.intense} {emotionT[secondary.intense]}</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * MoodWeather - Animated weather based on mood
 * Part of Phase 10 Premium Stats Redesign
 *
 * Shows current emotional state as animated weather visualization
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

type WeatherType = 'sunny' | 'partly-cloudy' | 'cloudy' | 'rainy' | 'stormy';

interface MoodWeatherProps {
  /** Current mood (great, good, okay, bad, terrible) */
  mood: 'great' | 'good' | 'okay' | 'bad' | 'terrible';
  /** Optional message to display */
  message?: string;
  /** Optional class name */
  className?: string;
}

const MOOD_TO_WEATHER: Record<string, WeatherType> = {
  great: 'sunny',
  good: 'partly-cloudy',
  okay: 'cloudy',
  bad: 'rainy',
  terrible: 'stormy',
};

const WEATHER_LABELS = {
  sunny: { en: 'Sunny', emoji: '☀️', gradient: 'from-amber-400/20 to-orange-500/10' },
  'partly-cloudy': { en: 'Partly Cloudy', emoji: '🌤️', gradient: 'from-blue-400/15 to-amber-400/10' },
  cloudy: { en: 'Cloudy', emoji: '☁️', gradient: 'from-slate-400/20 to-slate-500/10' },
  rainy: { en: 'Rainy', emoji: '🌧️', gradient: 'from-blue-500/20 to-indigo-500/15' },
  stormy: { en: 'Stormy', emoji: '⛈️', gradient: 'from-slate-600/25 to-purple-600/15' },
};

// SVG Weather Components

function SunnyWeather() {
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      {/* Sun rays */}
      <motion.div
        className="absolute w-full h-full animate-sun-rays"
        style={{ transformOrigin: 'center' }}
      >
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute top-1/2 left-1/2 w-1 h-6 bg-gradient-to-t from-amber-400 to-transparent rounded-full"
            style={{
              transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateY(-18px)`,
              opacity: 0.7,
            }}
          />
        ))}
      </motion.div>

      {/* Sun body */}
      <motion.div
        className="relative w-14 h-14 rounded-full bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-400 animate-sun-pulse"
        style={{
          boxShadow: '0 0 40px rgba(251, 191, 36, 0.6), 0 0 80px rgba(251, 191, 36, 0.3)'
        }}
      >
        {/* Face */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl">😊</span>
        </div>
      </motion.div>
    </div>
  );
}

function PartlyCloudyWeather() {
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      {/* Sun (behind) */}
      <motion.div
        className="absolute top-2 right-2 w-10 h-10 rounded-full bg-gradient-to-br from-amber-300 to-yellow-400"
        style={{
          boxShadow: '0 0 20px rgba(251, 191, 36, 0.4)'
        }}
        animate={{
          scale: [1, 1.05, 1],
        }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* Cloud */}
      <motion.div
        className="relative animate-cloud-drift"
      >
        <div className="flex items-end">
          <div className="w-8 h-8 rounded-full bg-gradient-to-b from-white to-slate-200 dark:from-slate-300 dark:to-slate-400" />
          <div className="w-12 h-12 rounded-full bg-gradient-to-b from-white to-slate-200 dark:from-slate-300 dark:to-slate-400 -ml-4" />
          <div className="w-8 h-8 rounded-full bg-gradient-to-b from-white to-slate-200 dark:from-slate-300 dark:to-slate-400 -ml-4" />
        </div>
      </motion.div>
    </div>
  );
}

function CloudyWeather() {
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      {/* Background cloud */}
      <motion.div
        className="absolute top-2 animate-cloud-drift-slow opacity-50"
      >
        <div className="flex items-end">
          <div className="w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-500" />
          <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-500 -ml-3" />
          <div className="w-5 h-5 rounded-full bg-slate-300 dark:bg-slate-500 -ml-2" />
        </div>
      </motion.div>

      {/* Main cloud */}
      <motion.div
        className="relative animate-cloud-drift"
      >
        <div className="flex items-end">
          <div className="w-8 h-8 rounded-full bg-gradient-to-b from-slate-200 to-slate-400 dark:from-slate-400 dark:to-slate-500" />
          <div className="w-14 h-14 rounded-full bg-gradient-to-b from-slate-200 to-slate-400 dark:from-slate-400 dark:to-slate-500 -ml-4" />
          <div className="w-10 h-10 rounded-full bg-gradient-to-b from-slate-200 to-slate-400 dark:from-slate-400 dark:to-slate-500 -ml-5" />
        </div>
        {/* Face */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg mt-2 ml-2">😐</span>
        </div>
      </motion.div>
    </div>
  );
}

function RainyWeather() {
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      {/* Cloud */}
      <motion.div className="relative">
        <div className="flex items-end">
          <div className="w-7 h-7 rounded-full bg-gradient-to-b from-slate-400 to-slate-500 dark:from-slate-500 dark:to-slate-600" />
          <div className="w-12 h-12 rounded-full bg-gradient-to-b from-slate-400 to-slate-500 dark:from-slate-500 dark:to-slate-600 -ml-3" />
          <div className="w-8 h-8 rounded-full bg-gradient-to-b from-slate-400 to-slate-500 dark:from-slate-500 dark:to-slate-600 -ml-4" />
        </div>
        {/* Face */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-base mt-1">😔</span>
        </div>
      </motion.div>

      {/* Rain drops */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            className={cn(
              'w-0.5 h-3 rounded-full bg-blue-400',
              `animate-rain-drop-${i + 1}`
            )}
            style={{
              animationDelay: `${i * 0.15}s`
            }}
          />
        ))}
      </div>
    </div>
  );
}

function StormyWeather() {
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      {/* Dark cloud */}
      <motion.div
        className="relative"
        animate={{ x: [-1, 1, -1] }}
        transition={{ duration: 0.3, repeat: Infinity, repeatType: 'reverse' }}
      >
        <div className="flex items-end">
          <div className="w-8 h-8 rounded-full bg-gradient-to-b from-slate-500 to-slate-700 dark:from-slate-600 dark:to-slate-800" />
          <div className="w-14 h-14 rounded-full bg-gradient-to-b from-slate-500 to-slate-700 dark:from-slate-600 dark:to-slate-800 -ml-4" />
          <div className="w-10 h-10 rounded-full bg-gradient-to-b from-slate-500 to-slate-700 dark:from-slate-600 dark:to-slate-800 -ml-5" />
        </div>
        {/* Face */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg mt-2 ml-2">😢</span>
        </div>
      </motion.div>

      {/* Lightning */}
      <motion.div
        className="absolute bottom-2 left-1/2 -translate-x-1/2 animate-lightning"
      >
        <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
          <path
            d="M11 1L3 14H10L9 23L17 10H10L11 1Z"
            fill="#fbbf24"
            stroke="#f59e0b"
            strokeWidth="1"
          />
        </svg>
      </motion.div>

      {/* Rain */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-2 opacity-70">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className={cn(
              'w-0.5 h-2 rounded-full bg-blue-500',
              `animate-rain-drop-${i + 1}`
            )}
          />
        ))}
      </div>
    </div>
  );
}

const WEATHER_COMPONENTS: Record<WeatherType, React.FC> = {
  sunny: SunnyWeather,
  'partly-cloudy': PartlyCloudyWeather,
  cloudy: CloudyWeather,
  rainy: RainyWeather,
  stormy: StormyWeather,
};

export function MoodWeather({
  mood,
  message,
  className,
}: MoodWeatherProps) {
  const { t } = useLanguage();

  const weather = MOOD_TO_WEATHER[mood];
  const weatherInfo = WEATHER_LABELS[weather];
  const WeatherComponent = WEATHER_COMPONENTS[weather];

  const defaultMessage = useMemo(() => {
    switch (mood) {
      case 'great': return t.weatherMessageGreat || 'Your mood is radiant today!';
      case 'good': return t.weatherMessageGood || 'Looking bright with some clouds';
      case 'okay': return t.weatherMessageOkay || 'A balanced, neutral day';
      case 'bad': return t.weatherMessageBad || 'Some rain, but it will pass';
      case 'terrible': return t.weatherMessageTerrible || 'Storms clear with time';
      default: return '';
    }
  }, [mood, t]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'relative overflow-hidden rounded-2xl p-4',
        'bg-gradient-to-br',
        weatherInfo.gradient,
        'border border-border/30',
        'backdrop-blur-sm',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg" role="img" aria-hidden="true">
          {weatherInfo.emoji}
        </span>
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          {t[`weather${weather.charAt(0).toUpperCase() + weather.slice(1).replace('-', '')}`] || weatherInfo.en}
        </h3>
      </div>

      {/* Weather visualization */}
      <div className="flex justify-center py-2">
        <WeatherComponent />
      </div>

      {/* Message */}
      <p className="text-xs text-muted-foreground text-center mt-2">
        {message || defaultMessage}
      </p>
    </motion.div>
  );
}

export default MoodWeather;

import { MoodType, MoodEntry } from "@/types";
import { EMOTION_GRADIENTS } from "@/lib/emotionConstants";

export interface CalendarDay {
  day: number | null;
  dateKey: string | null;
}

export interface DayData {
  mood?: MoodEntry;
  focusMinutes: number;
  habits: string[];
  gratitude: { id: string; text: string }[];
}

export const moodGradients: Record<MoodType, string> = {
  great: "from-emerald-400/80 to-teal-500/80",
  good: "from-green-400/80 to-emerald-500/80",
  okay: "from-amber-400/80 to-yellow-500/80",
  bad: "from-orange-400/80 to-amber-500/80",
  terrible: "from-red-400/80 to-rose-500/80",
};

// Helper to get gradient for mood entry (supports both emotions and legacy moods)
export const getEntryGradient = (entry: MoodEntry): string => {
  if (entry.emotion?.primary) {
    return EMOTION_GRADIENTS[entry.emotion.primary];
  }
  return moodGradients[entry.mood] || "from-gray-400/80 to-gray-500/80";
};

export const moodConfig: Record<MoodType, { gradient: string; bgLight: string; emoji: string }> = {
  great: {
    gradient: "from-emerald-400 to-teal-500",
    bgLight: "bg-emerald-500/20",
    emoji: "\u{1F604}",
  },
  good: {
    gradient: "from-green-400 to-emerald-500",
    bgLight: "bg-green-500/20",
    emoji: "\u{1F642}",
  },
  okay: {
    gradient: "from-amber-400 to-yellow-500",
    bgLight: "bg-amber-500/20",
    emoji: "\u{1F610}",
  },
  bad: {
    gradient: "from-orange-400 to-amber-500",
    bgLight: "bg-orange-500/20",
    emoji: "\u{1F614}",
  },
  terrible: {
    gradient: "from-red-400 to-rose-500",
    bgLight: "bg-red-500/20",
    emoji: "\u{1F622}",
  },
};

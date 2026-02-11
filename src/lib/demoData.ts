import type {
  Habit,
  MoodEntry,
  FocusSession,
  GratitudeEntry,
  Companion,
  MoodType,
} from '@/types';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function timestampDaysAgo(n: number, hour = 12): number {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

function lastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => daysAgo(i));
}

function lastNDaysExceptToday(n: number): string[] {
  return Array.from({ length: n }, (_, i) => daysAgo(i + 1));
}

const today = daysAgo(0);
const yesterday = daysAgo(1);
const twoDaysAgo = daysAgo(2);

const demoHabits: Habit[] = [
  {
    id: 'demo-1',
    name: 'Morning Meditation',
    icon: '\u{1F9D8}',
    color: '#8B5CF6',
    category: 'mindfulness',
    type: 'daily',
    frequency: 'daily',
    reminders: [],
    completedDates: lastNDays(14),
    createdAt: timestampDaysAgo(30),
  },
  {
    id: 'demo-2',
    name: 'Read 20 pages',
    icon: '\u{1F4DA}',
    color: '#3B82F6',
    category: 'productivity',
    type: 'daily',
    frequency: 'daily',
    reminders: [],
    completedDates: lastNDays(7),
    createdAt: timestampDaysAgo(20),
  },
  {
    id: 'demo-3',
    name: 'Exercise',
    icon: '\u{1F4AA}',
    color: '#10B981',
    category: 'health',
    type: 'daily',
    frequency: 'daily',
    reminders: [],
    completedDates: lastNDaysExceptToday(10),
    createdAt: timestampDaysAgo(25),
  },
  {
    id: 'demo-4',
    name: 'Journal',
    icon: '\u{270D}\u{FE0F}',
    color: '#F59E0B',
    category: 'mindfulness',
    type: 'daily',
    frequency: 'daily',
    reminders: [],
    completedDates: lastNDays(5),
    createdAt: timestampDaysAgo(15),
  },
  {
    id: 'demo-5',
    name: 'Drink Water',
    icon: '\u{1F4A7}',
    color: '#06B6D4',
    category: 'health',
    type: 'multiple',
    frequency: 'daily',
    dailyTarget: 8,
    reminders: [],
    completedDates: lastNDays(14),
    createdAt: timestampDaysAgo(30),
  },
];

const moodSequence: { mood: MoodType; note: string }[] = [
  { mood: 'okay', note: 'Starting the week steady' },
  { mood: 'good', note: 'Had a great workout' },
  { mood: 'good', note: 'Productive day at work' },
  { mood: 'great', note: 'Finished a big project' },
  { mood: 'great', note: 'Quality time with friends' },
  { mood: 'good', note: 'Relaxing weekend morning' },
  { mood: 'great', note: 'Feeling accomplished and grateful' },
];

const demoMoods: MoodEntry[] = moodSequence.map((entry, i) => {
  const dayOffset = 6 - i;
  return {
    id: `demo-mood-${i + 1}`,
    mood: entry.mood,
    note: entry.note,
    date: daysAgo(dayOffset),
    timestamp: timestampDaysAgo(dayOffset, 10 + (i % 3) * 4),
    tags: [],
  };
});

const focusLabels = ['Deep Work', 'Study', 'Creative', 'Planning', 'Review'];

const demoFocusSessions: FocusSession[] = Array.from({ length: 14 }, (_, i) => {
  const dayOffset = Math.floor(i / 2);
  const durations = [25, 45, 30, 50, 35, 40, 20, 45, 30, 55, 25, 40, 35, 50];
  const hours = i % 2 === 0 ? 9 : 14;
  return {
    id: `demo-focus-${i + 1}`,
    duration: durations[i],
    completedAt: timestampDaysAgo(dayOffset, hours),
    date: daysAgo(dayOffset),
    label: focusLabels[i % focusLabels.length],
    status: 'completed' as const,
  };
});

const demoGratitudeEntries: GratitudeEntry[] = [
  {
    id: 'demo-grat-1',
    text: 'Grateful for a productive morning session',
    date: today,
    timestamp: timestampDaysAgo(0, 8),
  },
  {
    id: 'demo-grat-2',
    text: 'Thankful for the beautiful weather on my walk',
    date: yesterday,
    timestamp: timestampDaysAgo(1, 18),
  },
  {
    id: 'demo-grat-3',
    text: 'Appreciated the help from my teammate',
    date: twoDaysAgo,
    timestamp: timestampDaysAgo(2, 12),
  },
];

export const DEMO_DATA = {
  profile: {
    name: 'Alex',
    level: 12,
    xp: 2450,
    xpToNextLevel: 3000,
    streak: 14,
    totalFocusMinutes: 4280,
    totalSessions: 186,
    joinDate: daysAgo(83),
  },

  habits: demoHabits,

  moods: demoMoods,

  focusSessions: demoFocusSessions,

  goals: [
    { id: 'demo-goal-1', title: 'Complete React Course', progress: 75, target: 100, unit: '%', icon: '\u{1F393}' },
    { id: 'demo-goal-2', title: 'Run 50km this month', progress: 32, target: 50, unit: 'km', icon: '\u{1F3C3}' },
    { id: 'demo-goal-3', title: 'Read 4 books', progress: 3, target: 4, unit: 'books', icon: '\u{1F4D6}' },
  ],

  gratitudeEntries: demoGratitudeEntries,

  tasks: [
    { id: 'demo-task-1', title: 'Review pull requests', completed: true, priority: 'high' as const },
    { id: 'demo-task-2', title: 'Write unit tests', completed: true, priority: 'medium' as const },
    { id: 'demo-task-3', title: 'Update documentation', completed: false, priority: 'medium' as const },
    { id: 'demo-task-4', title: 'Team standup notes', completed: false, priority: 'low' as const },
  ],

  weeklyStats: {
    focusMinutes: [45, 60, 30, 90, 75, 45, 60],
    habitsCompleted: [4, 5, 3, 5, 4, 5, 4],
    moodAverage: [3.5, 4.0, 3.8, 4.2, 4.5, 4.0, 4.3],
    daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
};

export function getDemoCompanionState(): Companion {
  return {
    type: 'fox',
    name: 'Kitsune',
    mood: 'happy',
    level: 12,
    experience: 2450,
    unlockedOutfits: ['default', 'wizard', 'explorer'],
    currentOutfit: 'explorer',
    lastInteraction: Date.now() - 1000 * 60 * 30,
    lastPetTime: Date.now() - 1000 * 60 * 60,
    lastFeedTime: Date.now() - 1000 * 60 * 90,
    interactionCount: 342,

    fullness: 80,

    happiness: 90,
    hunger: 20,
    personality: {
      energy: 70,
      wisdom: 65,
      warmth: 85,
    },
  };
}

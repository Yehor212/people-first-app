/**
 * Life context options for State of Mind.
 * What's influencing how you feel right now?
 */

export interface ContextOption {
  key: string;
  /** Lucide icon name */
  icon: string;
}

export const CONTEXT_OPTIONS: ContextOption[] = [
  { key: 'community', icon: 'Users' },
  { key: 'currentEvents', icon: 'Newspaper' },
  { key: 'dating', icon: 'Heart' },
  { key: 'education', icon: 'GraduationCap' },
  { key: 'family', icon: 'Home' },
  { key: 'fitness', icon: 'Dumbbell' },
  { key: 'friends', icon: 'UserPlus' },
  { key: 'gaming', icon: 'Gamepad2' },
  { key: 'health', icon: 'Activity' },
  { key: 'hobbies', icon: 'Palette' },
  { key: 'identity', icon: 'Fingerprint' },
  { key: 'money', icon: 'Wallet' },
  { key: 'spirituality', icon: 'Sparkles' },
  { key: 'tasks', icon: 'ListTodo' },
  { key: 'weather', icon: 'CloudSun' },
  { key: 'work', icon: 'Briefcase' },
  { key: 'partner', icon: 'HeartHandshake' },
  { key: 'selfCare', icon: 'Flower2' },
  { key: 'travel', icon: 'Plane' },
];

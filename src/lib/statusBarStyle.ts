import { registerPlugin } from '@capacitor/core';

interface StatusBarStylePlugin {
  setStyle(options: { style: 'DARK' | 'LIGHT' | 'DEFAULT' }): Promise<void>;
}

const StatusBarStyle = registerPlugin<StatusBarStylePlugin>('StatusBarStyle');

// Re-export Style enum for drop-in compatibility with ThemeToggle.tsx
export const Style = {
  Dark: 'DARK' as const,
  Light: 'LIGHT' as const,
  Default: 'DEFAULT' as const,
};

export { StatusBarStyle };

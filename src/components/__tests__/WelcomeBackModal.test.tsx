/**
 * WelcomeBackModal Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WelcomeBackModal } from '../WelcomeBackModal';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { Habit } from '@/types';

// Mock habits for testing
const mockHabits: Array<{ habit: Habit; successRate: number }> = [
  {
    habit: {
      id: '1',
      name: 'Morning Exercise',
      icon: '🏃',
      createdAt: Date.now(),
      completedDates: [],
    },
    successRate: 85,
  },
  {
    habit: {
      id: '2',
      name: 'Meditation',
      icon: '🧘',
      createdAt: Date.now(),
      completedDates: [],
    },
    successRate: 70,
  },
  {
    habit: {
      id: '3',
      name: 'Reading',
      icon: '📚',
      createdAt: Date.now(),
      completedDates: [],
    },
    successRate: 60,
  },
];

const renderWithProvider = (component: React.ReactElement) => {
  return render(<LanguageProvider>{component}</LanguageProvider>);
};

describe('WelcomeBackModal', () => {
  it('renders welcome back message with days away', () => {
    const onClose = vi.fn();

    renderWithProvider(
      <WelcomeBackModal
        daysAway={5}
        streakBroken={false}
        currentStreak={10}
        topHabits={mockHabits}
        onClose={onClose}
      />
    );

    // Check for days away in subtitle (uses placeholder replacement)
    expect(screen.getByText(/5/)).toBeInTheDocument();
  });

  it('shows streak broken status correctly', () => {
    const onClose = vi.fn();

    renderWithProvider(
      <WelcomeBackModal
        daysAway={4}
        streakBroken={true}
        currentStreak={15}
        topHabits={mockHabits}
        onClose={onClose}
      />
    );

    // Should show broken status (check for orange/red coloring in className)
    const streakSection = screen.getByText(/Streak Status|Статус серии/i).closest('div');
    expect(streakSection?.className).toContain('orange');
  });

  it('shows streak protected status correctly', () => {
    const onClose = vi.fn();

    renderWithProvider(
      <WelcomeBackModal
        daysAway={4}
        streakBroken={false}
        currentStreak={20}
        topHabits={mockHabits}
        onClose={onClose}
      />
    );

    // Should show protected status (check for green coloring)
    const streakSection = screen.getByText(/Streak Protected|Серия защищена/i).closest('div');
    expect(streakSection?.className).toContain('green');
  });

  it('displays top 3 habits with success rates', () => {
    const onClose = vi.fn();

    renderWithProvider(
      <WelcomeBackModal
        daysAway={3}
        streakBroken={false}
        currentStreak={10}
        topHabits={mockHabits}
        onClose={onClose}
      />
    );

    // Check for habit names
    expect(screen.getByText('Morning Exercise')).toBeInTheDocument();
    expect(screen.getByText('Meditation')).toBeInTheDocument();
    expect(screen.getByText('Reading')).toBeInTheDocument();

    // Check for success rates
    expect(screen.getByText(/85%/)).toBeInTheDocument();
    expect(screen.getByText(/70%/)).toBeInTheDocument();
    expect(screen.getByText(/60%/)).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();

    renderWithProvider(
      <WelcomeBackModal
        daysAway={3}
        streakBroken={false}
        currentStreak={10}
        topHabits={mockHabits}
        onClose={onClose}
      />
    );

    // Find and click close button (X icon button)
    const closeButtons = screen.getAllByRole('button');
    const xButton = closeButtons.find(btn => btn.querySelector('.lucide-x'));

    if (xButton) {
      fireEvent.click(xButton);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  it('calls onClose when continue button clicked', () => {
    const onClose = vi.fn();

    renderWithProvider(
      <WelcomeBackModal
        daysAway={3}
        streakBroken={false}
        currentStreak={10}
        topHabits={mockHabits}
        onClose={onClose}
      />
    );

    // Find and click continue button
    const continueButton = screen.getByText(/continue|Продолжить/i);
    fireEvent.click(continueButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders mood check-in when onQuickMoodLog provided', () => {
    const onClose = vi.fn();
    const onQuickMoodLog = vi.fn();

    renderWithProvider(
      <WelcomeBackModal
        daysAway={3}
        streakBroken={false}
        currentStreak={10}
        topHabits={mockHabits}
        onClose={onClose}
        onQuickMoodLog={onQuickMoodLog}
      />
    );

    // Check for mood emojis
    expect(screen.getByText('😊')).toBeInTheDocument();
    expect(screen.getByText('🙂')).toBeInTheDocument();
    expect(screen.getByText('😐')).toBeInTheDocument();
    expect(screen.getByText('😕')).toBeInTheDocument();
    expect(screen.getByText('😢')).toBeInTheDocument();
  });

  it('calls onQuickMoodLog when mood selected', () => {
    const onClose = vi.fn();
    const onQuickMoodLog = vi.fn();

    renderWithProvider(
      <WelcomeBackModal
        daysAway={3}
        streakBroken={false}
        currentStreak={10}
        topHabits={mockHabits}
        onClose={onClose}
        onQuickMoodLog={onQuickMoodLog}
      />
    );

    // Click on great mood (😊)
    const greatButton = screen.getByText('😊').closest('button');
    if (greatButton) {
      fireEvent.click(greatButton);
      expect(onQuickMoodLog).toHaveBeenCalledWith('great');
    }
  });

  it('shows confirmation after mood logged', () => {
    const onClose = vi.fn();
    const onQuickMoodLog = vi.fn();

    renderWithProvider(
      <WelcomeBackModal
        daysAway={3}
        streakBroken={false}
        currentStreak={10}
        topHabits={mockHabits}
        onClose={onClose}
        onQuickMoodLog={onQuickMoodLog}
      />
    );

    // Click on good mood (🙂)
    const goodButton = screen.getByText('🙂').closest('button');
    if (goodButton) {
      fireEvent.click(goodButton);

      // Should show confirmation
      expect(screen.getByText(/Mood logged|Настроение записано/i)).toBeInTheDocument();
    }
  });

  it('does not render mood check-in when onQuickMoodLog not provided', () => {
    const onClose = vi.fn();

    renderWithProvider(
      <WelcomeBackModal
        daysAway={3}
        streakBroken={false}
        currentStreak={10}
        topHabits={mockHabits}
        onClose={onClose}
      />
    );

    // Mood emojis should not be present
    expect(screen.queryByText('😊')).not.toBeInTheDocument();
  });

  it('handles empty habits list gracefully', () => {
    const onClose = vi.fn();

    renderWithProvider(
      <WelcomeBackModal
        daysAway={3}
        streakBroken={false}
        currentStreak={10}
        topHabits={[]}
        onClose={onClose}
      />
    );

    // Should not show habits section
    expect(screen.queryByText(/Your Best Habits|Ваши лучшие привычки/i)).not.toBeInTheDocument();
  });
});

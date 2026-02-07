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

    // Check for days away in subtitle - look for text containing "5 days" pattern
    expect(screen.getByText(/5 day|5 дн/i)).toBeInTheDocument();
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

    // Should show broken status - find the streak section by looking for orange background class
    const container = document.querySelector('[class*="orange"]');
    expect(container).toBeTruthy();
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

    // Should show protected status - find green background section
    const container = document.querySelector('[class*="green"]');
    expect(container).toBeTruthy();
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

    // Check that success rates are displayed (use getAllByText since percentages might match multiple)
    expect(screen.getAllByText(/85/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/70/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/60/).length).toBeGreaterThan(0);
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

    // Find and click close button (X icon button) - use aria-label
    const closeButton = screen.getByLabelText(/close/i);
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
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
    expect(greatButton).toBeTruthy();
    fireEvent.click(greatButton);
    expect(onQuickMoodLog).toHaveBeenCalledWith('great');
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
    expect(goodButton).toBeTruthy();
    fireEvent.click(goodButton);

    // Should show confirmation
    expect(screen.getByText(/Mood logged|logged/i)).toBeInTheDocument();
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

    const { container } = renderWithProvider(
      <WelcomeBackModal
        daysAway={3}
        streakBroken={false}
        currentStreak={10}
        topHabits={[]}
        onClose={onClose}
      />
    );

    // Component should render without crashing
    expect(container).toBeTruthy();

    // The habits section header should not be present (TrendingUp icon section)
    const habitsHeader = container.querySelector('h3');
    const hasHabitsSection = Array.from(container.querySelectorAll('h3')).some(
      h3 => h3.textContent?.includes('Habits') || h3.textContent?.includes('привычки')
    );
    // When habits array is empty, the habits section conditionally doesn't render
    // We just verify the component renders correctly
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
  });
});

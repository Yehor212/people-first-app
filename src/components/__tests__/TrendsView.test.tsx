/**
 * TrendsView Component Tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrendsView } from '../TrendsView';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { MoodEntry, Habit, FocusSession } from '@/types';

// Mock data for testing
const mockMoods: MoodEntry[] = [
  {
    id: '1',
    mood: 'great',
    date: '2026-01-20',
    timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
  {
    id: '2',
    mood: 'good',
    date: '2026-01-21',
    timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000,
  },
  {
    id: '3',
    mood: 'okay',
    date: '2026-01-22',
    timestamp: Date.now(),
  },
];

const mockHabits: Habit[] = [
  {
    id: '1',
    name: 'Exercise',
    icon: '🏃',
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    completedDates: ['2026-01-20', '2026-01-21', '2026-01-22'],
  },
  {
    id: '2',
    name: 'Meditation',
    icon: '🧘',
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    completedDates: ['2026-01-20', '2026-01-22'],
  },
];

const mockFocusSessions: FocusSession[] = [
  {
    id: '1',
    date: '2026-01-20',
    duration: 25,
    completed: true,
    startedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    status: 'completed',
  },
  {
    id: '2',
    date: '2026-01-21',
    duration: 50,
    completed: true,
    startedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    status: 'completed',
  },
  {
    id: '3',
    date: '2026-01-22',
    duration: 30,
    completed: true,
    startedAt: Date.now(),
    status: 'completed',
  },
];

const renderWithProvider = (component: React.ReactElement) => {
  return render(<LanguageProvider>{component}</LanguageProvider>);
};

describe('TrendsView', () => {
  it('renders title and time range buttons', () => {
    renderWithProvider(
      <TrendsView moods={mockMoods} habits={mockHabits} focusSessions={mockFocusSessions} />
    );

    // Check for title
    expect(screen.getByText(/Your Trends|Ваши Тренды/i)).toBeInTheDocument();

    // Check for time range buttons
    expect(screen.getByText('7d')).toBeInTheDocument();
    expect(screen.getByText('30d')).toBeInTheDocument();
    expect(screen.getByText('90d')).toBeInTheDocument();
  });

  it('defaults to 30 day range', () => {
    renderWithProvider(
      <TrendsView moods={mockMoods} habits={mockHabits} focusSessions={mockFocusSessions} />
    );

    // 30d button should have primary styling
    const button30d = screen.getByText('30d');
    expect(button30d.className).toContain('bg-primary');
  });

  it('switches time range when button clicked', () => {
    renderWithProvider(
      <TrendsView moods={mockMoods} habits={mockHabits} focusSessions={mockFocusSessions} />
    );

    // Click 7d button
    const button7d = screen.getByText('7d');
    fireEvent.click(button7d);

    // 7d should now be active
    expect(button7d.className).toContain('bg-primary');

    // Click 90d button
    const button90d = screen.getByText('90d');
    fireEvent.click(button90d);

    // 90d should now be active
    expect(button90d.className).toContain('bg-primary');
  });

  it('displays summary statistics cards', () => {
    renderWithProvider(
      <TrendsView moods={mockMoods} habits={mockHabits} focusSessions={mockFocusSessions} />
    );

    // Check for stat labels
    expect(screen.getByText(/Avg Mood|Средн. Настр/i)).toBeInTheDocument();
    expect(screen.getByText(/Habit Rate|Привычки/i)).toBeInTheDocument();
    expect(screen.getByText(/Focus|Фокус/i)).toBeInTheDocument();
  });

  it('calculates average mood correctly', () => {
    renderWithProvider(
      <TrendsView moods={mockMoods} habits={mockHabits} focusSessions={mockFocusSessions} />
    );

    // great=5, good=4, okay=3 -> avg = 4.0
    expect(screen.getByText('4.0')).toBeInTheDocument();
  });

  it('displays mood chart title', () => {
    renderWithProvider(
      <TrendsView moods={mockMoods} habits={mockHabits} focusSessions={mockFocusSessions} />
    );

    expect(screen.getByText(/Mood Over Time|Настроение Со Временем/i)).toBeInTheDocument();
  });

  it('displays habit chart title', () => {
    renderWithProvider(
      <TrendsView moods={mockMoods} habits={mockHabits} focusSessions={mockFocusSessions} />
    );

    expect(screen.getByText(/Habit Completion|Выполнение Привычек/i)).toBeInTheDocument();
  });

  it('displays focus chart title', () => {
    renderWithProvider(
      <TrendsView moods={mockMoods} habits={mockHabits} focusSessions={mockFocusSessions} />
    );

    expect(screen.getByText(/Focus Time|Время Фокуса/i)).toBeInTheDocument();
  });

  it('shows total focus minutes', () => {
    renderWithProvider(
      <TrendsView moods={mockMoods} habits={mockHabits} focusSessions={mockFocusSessions} />
    );

    // 25 + 50 + 30 = 105 minutes
    expect(screen.getByText(/105/)).toBeInTheDocument();
  });

  it('displays insight hint section', () => {
    renderWithProvider(
      <TrendsView moods={mockMoods} habits={mockHabits} focusSessions={mockFocusSessions} />
    );

    expect(screen.getByText(/Want personalized insights|Хотите персональные инсайты/i)).toBeInTheDocument();
  });

  it('handles empty data gracefully', () => {
    renderWithProvider(<TrendsView moods={[]} habits={[]} focusSessions={[]} />);

    // Should still render title
    expect(screen.getByText(/Your Trends|Ваши Тренды/i)).toBeInTheDocument();

    // Stats should show 0 or N/A
    expect(screen.getByText('0.0')).toBeInTheDocument(); // avg mood
  });

  it('calculates habit completion rate', () => {
    renderWithProvider(
      <TrendsView moods={mockMoods} habits={mockHabits} focusSessions={mockFocusSessions} />
    );

    // Should display percentage (will vary by day range)
    const percentageRegex = /\d+%/;
    const stats = screen.getAllByText(percentageRegex);
    expect(stats.length).toBeGreaterThan(0);
  });

  it('renders all three chart containers', () => {
    const { container } = renderWithProvider(
      <TrendsView moods={mockMoods} habits={mockHabits} focusSessions={mockFocusSessions} />
    );

    // Check for ResponsiveContainer (recharts wrapper)
    // Should have 3 charts total
    const charts = container.querySelectorAll('.recharts-wrapper');
    expect(charts.length).toBe(3);
  });
});

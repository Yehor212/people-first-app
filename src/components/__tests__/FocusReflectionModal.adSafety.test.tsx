import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FocusReflectionModal } from '@/components/FocusReflectionModal';

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: {
      ariaFocusReflection: 'Focus reflection',
      close: 'Close',
      focusReflectionTitle: 'Session reflection',
      focusReflectionQuestion: 'How did this focus session feel?',
      focusReflectionSkip: 'Skip',
      focusReflectionSave: 'Save',
      focusExpandToJournal: 'Write about it in your journal',
    },
  }),
}));

vi.mock('@/hooks/useModalState', () => ({
  useModalClose: vi.fn(),
}));

vi.mock('@/components/cosmic/CosmicStarField', () => ({
  CosmicStar: ({ id }: { id: string }) => <span data-testid={`cosmic-star-${id}`} />,
  cosmicStars: [{ id: 's1' }, { id: 's2' }],
}));

vi.mock('@/components/ads/RewardedAdPrompt', () => ({
  RewardedAdPrompt: () => <div data-testid="rewarded-ad-prompt" />,
}));

vi.mock('framer-motion', async () => {
  const React = await import('react');
  const stripMotionProps = <T extends Record<string, unknown>>(props: T) => {
    const {
      animate: _animate,
      initial: _initial,
      transition: _transition,
      whileHover: _whileHover,
      whileTap: _whileTap,
      ...rest
    } = props;
    return rest;
  };

  return {
    motion: {
      div: React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(function MotionDiv(
        { children, ...props },
        ref,
      ) {
        return <div ref={ref} {...stripMotionProps(props)}>{children}</div>;
      }),
      button: React.forwardRef<HTMLButtonElement, React.ComponentProps<'button'>>(function MotionButton(
        { children, ...props },
        ref,
      ) {
        return <button ref={ref} {...stripMotionProps(props)}>{children}</button>;
      }),
    },
  };
});

describe('FocusReflectionModal ad safety', () => {
  it('does not place rewarded ads inside the reflection decision moment', () => {
    render(
      <FocusReflectionModal
        reflectionValue={3}
        onSelectValue={vi.fn()}
        onSave={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Focus reflection' })).toBeInTheDocument();
    expect(screen.queryByTestId('rewarded-ad-prompt')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' }).className).toContain('min-h-[44px]');
  });
});

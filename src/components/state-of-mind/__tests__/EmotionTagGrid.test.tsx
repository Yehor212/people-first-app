import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmotionTagGrid } from '../EmotionTagGrid';
import { getTagsForValence, getInitialTagsForValence } from '../emotionTags';

// Minimal i18n mock — real keys would require LanguageProvider wrap.
vi.mock('@/contexts/LanguageContext', () => {
  // Build a proxy that returns capitalised key for any missing lookup so we
  // never crash on new emotion keys.
  const t = new Proxy<Record<string, string>>(
    {
      somShowMore: 'Show more',
      emotionMorePrecise: 'More precise',
    },
    {
      get: (target, prop: string) => target[prop] ?? prop,
    },
  );
  return {
    useLanguage: () => ({ t, language: 'en', isRTL: false }),
  };
});

vi.mock('@/lib/haptics', () => ({
  haptics: { light: vi.fn() },
}));

// Motion doesn't need to actually run in jsdom.
vi.mock('framer-motion', () => {
  const mkEl = (tag: string) =>
    React.forwardRef(
      (
        {
          children,
          // Remove framer-specific props so React doesn't warn.
          variants,
          whileTap,
          whileHover,
          animate,
          initial,
          transition,
          exit,
          ...rest
        }: Record<string, unknown> & { children?: React.ReactNode },
        ref: React.Ref<HTMLElement>,
      ) => {
        void variants;
        void whileTap;
        void whileHover;
        void animate;
        void initial;
        void transition;
        void exit;
        return React.createElement(tag, { ref, ...rest }, children);
      },
    );
  return {
    motion: new Proxy(
      {},
      {
        get: (_t, prop: string) => mkEl(prop),
      },
    ),
  };
});

describe('EmotionTagGrid — progressive disclosure (Phase 3-A.4c-ii-c)', () => {
  const baseProps = {
    // Bucket-edge valence — exercises the "TERRIBLE" bucket only, so tests
    // can rely on the documented exact chip counts (8 initial / 20 full).
    // Mid-bucket overlap is exercised by a dedicated test below.
    valence: -0.9,
    selected: [] as string[],
    onToggle: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('V1 default (expandable undefined) renders first 8 tags with Show More', () => {
    render(<EmotionTagGrid {...baseProps} />);
    const chips = screen.getAllByRole('button');
    // 8 initial chips + 1 "Show More" button = 9 buttons.
    expect(chips.length).toBe(9);
    expect(screen.getByText('Show more')).toBeInTheDocument();
  });

  it('V1 default after Show More reveals every tag and hides the button', () => {
    render(<EmotionTagGrid {...baseProps} />);
    fireEvent.click(screen.getByText('Show more'));
    const all = getTagsForValence(baseProps.valence);
    // After V1 expansion: total buttons = tags (no collapse button).
    expect(screen.getAllByRole('button').length).toBe(all.length);
  });

  it('expandable=true renders only initialVisible (tier-1) chips', () => {
    render(<EmotionTagGrid {...baseProps} expandable />);
    const initial = getInitialTagsForValence(baseProps.valence);
    expect(initial).toHaveLength(8);
    // 8 chips + 1 "More precise" button.
    const chips = screen.getAllByRole('button');
    expect(chips.length).toBe(9);
  });

  it('expandable=true shows "More precise" label from i18n', () => {
    render(<EmotionTagGrid {...baseProps} expandable />);
    const btn = screen.getByTestId('emotion-more-precise');
    expect(btn).toHaveTextContent('More precise');
  });

  it('expandable=true wires the precision toggle to the chip group', () => {
    render(<EmotionTagGrid {...baseProps} expandable />);
    const btn = screen.getByTestId('emotion-more-precise');
    const chips = screen.getByTestId('emotion-tag-chips');

    expect(btn).toHaveAttribute('aria-controls', 'emotion-tag-chips');
    expect(chips).toHaveAttribute('id', 'emotion-tag-chips');
  });

  it('expandable=true: aria-expanded is false collapsed, true after tap', () => {
    render(<EmotionTagGrid {...baseProps} expandable />);
    const btn = screen.getByTestId('emotion-more-precise');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
  });

  it('expandable=true tap expands to full list', () => {
    render(<EmotionTagGrid {...baseProps} expandable />);
    fireEvent.click(screen.getByTestId('emotion-more-precise'));
    const all = getTagsForValence(baseProps.valence);
    // Full spectrum = tag chips + 1 collapse button.
    expect(screen.getAllByRole('button').length).toBe(all.length + 1);
  });

  it('expandable=true second tap collapses back to tier-1', () => {
    render(<EmotionTagGrid {...baseProps} expandable />);
    const btn = screen.getByTestId('emotion-more-precise');
    fireEvent.click(btn);
    fireEvent.click(btn);
    // Back to 8 chips + 1 button.
    expect(screen.getAllByRole('button').length).toBe(9);
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('onExpandToggle fires with the new expanded value', () => {
    const onExpandToggle = vi.fn();
    render(
      <EmotionTagGrid
        {...baseProps}
        expandable
        onExpandToggle={onExpandToggle}
      />,
    );
    fireEvent.click(screen.getByTestId('emotion-more-precise'));
    expect(onExpandToggle).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByTestId('emotion-more-precise'));
    expect(onExpandToggle).toHaveBeenCalledWith(false);
  });

  it('toggling a chip calls onToggle with the tag key', () => {
    render(<EmotionTagGrid {...baseProps} expandable />);
    // First chip (warmth-sorted tier-1).
    const initial = getInitialTagsForValence(baseProps.valence);
    const firstKey = initial[0].key;
    fireEvent.click(screen.getByTestId(`emotion-chip-${firstKey}`));
    expect(baseProps.onToggle).toHaveBeenCalledWith(firstKey);
  });

  it('ArrowRight moves focus to the next chip in the grid', () => {
    render(<EmotionTagGrid {...baseProps} expandable />);
    const initial = getInitialTagsForValence(baseProps.valence);
    const first = screen.getByTestId(`emotion-chip-${initial[0].key}`);
    const second = screen.getByTestId(`emotion-chip-${initial[1].key}`);
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(second);
  });

  it('ArrowLeft from first chip wraps to last chip', () => {
    render(<EmotionTagGrid {...baseProps} expandable />);
    const initial = getInitialTagsForValence(baseProps.valence);
    const first = screen.getByTestId(`emotion-chip-${initial[0].key}`);
    const last = screen.getByTestId(
      `emotion-chip-${initial[initial.length - 1].key}`,
    );
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(last);
  });

  it('sensitive tags (e.g. hopeless) render as testable chips in terrible bucket', () => {
    render(<EmotionTagGrid {...baseProps} expandable />);
    // "hopeless" is initialVisible in terrible bucket.
    expect(screen.getByTestId('emotion-chip-hopeless')).toBeInTheDocument();
  });

  it('expandable=true mid-bucket valence enriches initial set with overlap', () => {
    // v=-0.8 sits inside TERRIBLE, but BAD bucket range bleeds in, so the
    // tier-1 reveal is wider than a single bucket — intentional design.
    render(
      <EmotionTagGrid {...baseProps} valence={-0.8} expandable />,
    );
    const initialAtEdge = getInitialTagsForValence(-0.9);
    const initialAtMid = getInitialTagsForValence(-0.8);
    expect(initialAtMid.length).toBeGreaterThan(initialAtEdge.length);
  });
});

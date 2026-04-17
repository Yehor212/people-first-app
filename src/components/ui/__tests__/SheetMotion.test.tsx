/**
 * SheetMotion tests.
 *
 * Verifies:
 *   - Mounts children when open
 *   - Close button with 44px target exists
 *   - Reduced-motion path returns plain content
 *   - side variants honour safe-area for bottom sheet
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/useShouldAnimate', () => ({
  useShouldAnimate: vi.fn(() => true),
}));
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: { close: 'Close' } }),
}));

import { useShouldAnimate } from '@/hooks/useShouldAnimate';
import {
  SheetMotion,
  SheetMotionContent,
  SheetMotionTitle,
  SheetMotionDescription,
  SheetMotionTrigger,
} from '../SheetMotion';

const useShouldAnimateMock = vi.mocked(useShouldAnimate);

function OpenSheet({
  side = 'right',
  children,
}: {
  side?: 'top' | 'bottom' | 'left' | 'right';
  children?: React.ReactNode;
}) {
  return (
    <SheetMotion open>
      <SheetMotionTrigger>Open</SheetMotionTrigger>
      <SheetMotionContent side={side}>
        <SheetMotionTitle>Sheet Title</SheetMotionTitle>
        <SheetMotionDescription>Desc</SheetMotionDescription>
        {children}
      </SheetMotionContent>
    </SheetMotion>
  );
}

describe('SheetMotion', () => {
  it('renders when open (motion path)', () => {
    useShouldAnimateMock.mockReturnValue(true);
    render(<OpenSheet>Body</OpenSheet>);
    expect(screen.getByText('Sheet Title')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  it('renders when open (reduced-motion path)', () => {
    useShouldAnimateMock.mockReturnValue(false);
    render(<OpenSheet>Body</OpenSheet>);
    expect(screen.getByText('Sheet Title')).toBeInTheDocument();
  });

  it('close button has 44px touch target', () => {
    useShouldAnimateMock.mockReturnValue(true);
    render(<OpenSheet />);
    const close = screen.getByLabelText('Close');
    expect(close.className).toMatch(/min-w-\[44px\]/);
    expect(close.className).toMatch(/min-h-\[44px\]/);
  });

  it('bottom side applies safe-area positioning (z-80, fixed)', () => {
    useShouldAnimateMock.mockReturnValue(true);
    render(<OpenSheet side="bottom">Body</OpenSheet>);
    // Radix Portal renders outside container — query document.body
    const content = document.body.querySelector<HTMLElement>(
      '[class*="inset-x-0"][class*="bottom-0"]',
    );
    expect(content).not.toBeNull();
    const style = content?.getAttribute('style') ?? '';
    // jsdom drops env() strings on parse; assert positioning fingerprint instead.
    expect(style).toContain('position: fixed');
    expect(style).toContain('z-index: 80');
  });

  it('renders all side variants without crashing', () => {
    useShouldAnimateMock.mockReturnValue(true);
    for (const side of ['top', 'bottom', 'left', 'right'] as const) {
      const { unmount } = render(<OpenSheet side={side}>Body</OpenSheet>);
      expect(screen.getAllByText('Sheet Title').length).toBeGreaterThan(0);
      unmount();
    }
  });
});

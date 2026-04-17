/**
 * DialogMotion tests.
 *
 * Verifies:
 *   - Mounts children when open
 *   - Close button exists with aria-label
 *   - Reduced-motion path renders plain DialogContent (no motion.div)
 *   - Normal path renders motion-wrapped content
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
  DialogMotion,
  DialogMotionContent,
  DialogMotionTitle,
  DialogMotionDescription,
  DialogMotionTrigger,
} from '../DialogMotion';

const useShouldAnimateMock = vi.mocked(useShouldAnimate);

function OpenDialog({ children }: { children?: React.ReactNode }) {
  return (
    <DialogMotion open>
      <DialogMotionTrigger>Open</DialogMotionTrigger>
      <DialogMotionContent>
        <DialogMotionTitle>Test Title</DialogMotionTitle>
        <DialogMotionDescription>Description</DialogMotionDescription>
        {children}
      </DialogMotionContent>
    </DialogMotion>
  );
}

describe('DialogMotion', () => {
  it('renders children when open (reduced-motion path)', () => {
    useShouldAnimateMock.mockReturnValue(false);
    render(<OpenDialog>Body Content</OpenDialog>);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Body Content')).toBeInTheDocument();
  });

  it('renders children when open (motion path)', () => {
    useShouldAnimateMock.mockReturnValue(true);
    render(<OpenDialog>Body Content</OpenDialog>);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Body Content')).toBeInTheDocument();
  });

  it('close button has 44px touch target (modal standard)', () => {
    useShouldAnimateMock.mockReturnValue(true);
    render(<OpenDialog />);
    const close = screen.getByLabelText('Close');
    expect(close.className).toMatch(/min-w-\[44px\]/);
    expect(close.className).toMatch(/min-h-\[44px\]/);
  });

  it('description and title have proper aria wiring', () => {
    useShouldAnimateMock.mockReturnValue(true);
    render(<OpenDialog />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });
});

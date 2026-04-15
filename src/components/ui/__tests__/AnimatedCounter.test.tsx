import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock animationUtils BEFORE importing the component
vi.mock('@/lib/animationUtils', () => ({
  shouldAnimate: vi.fn(() => false),
}));

// Mock framer-motion spring utilities
vi.mock('framer-motion', () => {
  const actual = { __esModule: true };
  return {
    ...actual,
    useSpring: vi.fn(() => ({ set: vi.fn(), get: vi.fn(() => 0) })),
    useMotionValueEvent: vi.fn(),
    memo: (fn: unknown) => fn,
  };
});

import { AnimatedCounter } from '../AnimatedCounter';

describe('AnimatedCounter', () => {
  it('displays target immediately when shouldAnimate() returns false', () => {
    render(<AnimatedCounter target={42} />);
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('applies custom format function', () => {
    const format = (v: number) => `$${v.toFixed(2)}`;
    render(<AnimatedCounter target={99} format={format} />);
    expect(screen.getByText('$99.00')).toBeTruthy();
  });

  it('appends suffix correctly', () => {
    render(<AnimatedCounter target={7} suffix=" days" />);
    const el = screen.getByText((content) => content.includes('7'));
    expect(el.textContent).toBe('7 days');
  });
});

/**
 * Morph verb tests — consumes transition() wrapper, passes view-transition-name.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { transitionMock, withTransitionNameMock } = vi.hoisted(() => ({
  transitionMock: vi.fn(async (fn: () => void | Promise<void>) => {
    await fn();
  }),
  withTransitionNameMock: vi.fn((name: string) => ({ viewTransitionName: name })),
}));

vi.mock('@/lib/viewTransitions', () => ({
  transition: transitionMock,
  withTransitionName: withTransitionNameMock,
}));

import { morph, morphTiming, withTransitionName } from '../morph';
import { easings } from '../easings';

describe('morph()', () => {
  beforeEach(() => {
    transitionMock.mockClear();
    withTransitionNameMock.mockClear();
  });

  it('delegates to transition() with the name option', async () => {
    const fn = vi.fn();
    await morph('card-to-editor', fn);
    expect(transitionMock).toHaveBeenCalledTimes(1);
    expect(transitionMock).toHaveBeenCalledWith(fn, { name: 'card-to-editor' });
    expect(fn).toHaveBeenCalled();
  });

  it('awaits the underlying transition before returning', async () => {
    let done = false;
    transitionMock.mockImplementationOnce(async (cb: () => void | Promise<void>) => {
      await cb();
      done = true;
    });
    await morph('any', () => undefined);
    expect(done).toBe(true);
  });

  it('passes async callbacks through unchanged', async () => {
    const fn = vi.fn().mockResolvedValue('result');
    await morph('async', fn);
    expect(fn).toHaveBeenCalled();
  });
});

describe('morphTiming', () => {
  it('is 420ms — cinematic duration', () => {
    expect(morphTiming.durationMs).toBe(420);
  });

  it('uses expo ease-out', () => {
    expect(morphTiming.ease).toBe(easings.morphExpo);
  });
});

describe('withTransitionName re-export', () => {
  it('proxies to the viewTransitions helper', () => {
    const style = withTransitionName('mood-orb');
    expect(withTransitionNameMock).toHaveBeenCalledWith('mood-orb');
    expect(style).toEqual({ viewTransitionName: 'mood-orb' });
  });
});

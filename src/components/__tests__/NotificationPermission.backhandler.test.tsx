import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

describe('NotificationPermission — Android Back Handler (Law 10)', () => {
  it('should import useBackHandler hook', () => {
    const source = readFileSync('src/components/NotificationPermission.tsx', 'utf8');
    expect(source).toContain("from \"@/hooks/useBackHandler\"");
    expect(source).toContain('useBackHandler');
  });

  it('should wire useBackHandler to showPrompt state and handleDeny close callback', () => {
    const source = readFileSync('src/components/NotificationPermission.tsx', 'utf8');
    expect(source).toMatch(/useBackHandler\(\s*showPrompt\s*,\s*handleDeny\s*\)/);
  });

  it('keeps the native permission dialog reachable at short viewport heights', () => {
    const source = readFileSync('src/components/NotificationPermission.tsx', 'utf8');

    expect(source).toContain('overflow-y-auto');
    expect(source).toContain('overscroll-contain');
    expect(source).toContain('var(--safe-top)');
    expect(source).toContain('var(--safe-bottom)');
    expect(source).toContain('var(--safe-inline-start)');
    expect(source).toContain('var(--safe-inline-end)');
    expect(source).toContain('relative my-auto');
    expect(source).toContain('h-auto min-h-12 w-full min-w-0');
    expect(source).toContain('whitespace-normal break-words');
  });
});

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
});

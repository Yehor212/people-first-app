import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

describe('DailySurprise — Android Back Handler (Law 10)', () => {
  it('should import and use useBackHandler', () => {
    const source = readFileSync('src/components/daily-surprise/DailySurprise.tsx', 'utf8');
    expect(source).toContain('useBackHandler');
  });

  it('should call useBackHandler with isOpen state', () => {
    const source = readFileSync('src/components/daily-surprise/DailySurprise.tsx', 'utf8');
    expect(source).toMatch(/useBackHandler/);
    expect(source).toContain("isOpen");
  });
});
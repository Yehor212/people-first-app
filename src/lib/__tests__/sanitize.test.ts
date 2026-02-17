import { describe, it, expect } from 'vitest';
import { sanitizeString, sanitizeUserName } from '@/lib/sanitize';

// ─── sanitizeString ──────────────────────────────────────────────

describe('sanitizeString', () => {
  it('passes through normal text unchanged', () => {
    expect(sanitizeString('Hello World')).toBe('Hello World');
  });

  it('strips HTML bold tags, keeping inner text', () => {
    expect(sanitizeString('<b>bold</b>')).toBe('bold');
  });

  it('strips script tags and their content', () => {
    expect(sanitizeString('<script>alert(1)</script>')).toBe('');
  });

  it('strips javascript: protocol', () => {
    expect(sanitizeString('javascript:alert(1)')).toBe('alert(1)');
  });

  it('strips data: protocol', () => {
    expect(sanitizeString('data:text/html,<h1>hi</h1>')).toBe('text/html,hi');
  });

  it('strips vbscript: protocol', () => {
    expect(sanitizeString('vbscript:MsgBox("hi")')).toBe('MsgBox("hi")');
  });

  it('strips onclick= attribute pattern', () => {
    expect(sanitizeString('onclick=alert(1)')).toBe('alert(1)');
  });

  it('strips onerror= attribute pattern', () => {
    expect(sanitizeString('onerror=doEvil()')).toBe('doEvil()');
  });

  it('strips eval(...) calls', () => {
    expect(sanitizeString('eval(code)')).toBe('code)');
  });

  it('strips expression(...) calls', () => {
    expect(sanitizeString('expression(evil)')).toBe('evil)');
  });

  it('strips url(...) calls', () => {
    expect(sanitizeString('url(http://evil.com)')).toBe('http://evil.com)');
  });

  it('removes angle brackets < >', () => {
    const result = sanitizeString('a < b > c');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });

  it('removes curly braces { }', () => {
    const result = sanitizeString('obj { key: val }');
    expect(result).not.toContain('{');
    expect(result).not.toContain('}');
  });

  it('removes backslashes', () => {
    expect(sanitizeString('path\\to\\file')).toBe('pathtofile');
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  it('truncates at 1000 characters', () => {
    const long = 'a'.repeat(1500);
    expect(sanitizeString(long).length).toBe(1000);
  });

  it('handles empty string returning empty', () => {
    expect(sanitizeString('')).toBe('');
  });

  it('is case-insensitive for JAVASCRIPT:', () => {
    expect(sanitizeString('JAVASCRIPT:alert(1)')).toBe('alert(1)');
  });

  it('is case-insensitive for OnClick=', () => {
    expect(sanitizeString('OnClick=doStuff()')).toBe('doStuff()');
  });

  it('handles unicode text', () => {
    expect(sanitizeString('Привет мир')).toBe('Привет мир');
  });
});

// ─── sanitizeUserName ────────────────────────────────────────────

describe('sanitizeUserName', () => {
  it('passes clean name through', () => {
    expect(sanitizeUserName('Alice')).toBe('Alice');
  });

  it('sanitizes HTML in name', () => {
    expect(sanitizeUserName('<b>Bob</b>')).toBe('Bob');
  });

  it('truncates at 100 characters', () => {
    const longName = 'A'.repeat(200);
    expect(sanitizeUserName(longName).length).toBe(100);
  });

  it('handles unicode names', () => {
    expect(sanitizeUserName('Олександр')).toBe('Олександр');
  });

  it('handles empty string', () => {
    expect(sanitizeUserName('')).toBe('');
  });
});

import { describe, it, expect } from 'vitest';
import { countWords, countWordsHtml } from '../types';

describe('countWords', () => {
  it('returns 0 for empty string', () => {
    expect(countWords('')).toBe(0);
  });

  it('returns 0 for whitespace-only string', () => {
    expect(countWords('   \t\n  ')).toBe(0);
  });

  it('counts plain text words', () => {
    expect(countWords('hello world')).toBe(2);
  });

  it('collapses multiple whitespace between words', () => {
    expect(countWords('hello   world   foo')).toBe(3);
  });

  it('trims leading and trailing whitespace', () => {
    expect(countWords('  hello world  ')).toBe(2);
  });
});

describe('countWordsHtml', () => {
  it('returns 0 for empty string', () => {
    expect(countWordsHtml('')).toBe(0);
  });

  it('counts plain text words', () => {
    expect(countWordsHtml('hello world')).toBe(2);
  });

  it('strips HTML tags before counting', () => {
    expect(countWordsHtml('<p>hello</p> <b>world</b>')).toBe(2);
  });

  it('treats &nbsp; as space', () => {
    expect(countWordsHtml('hello&nbsp;world')).toBe(2);
  });

  it('collapses multiple whitespace after stripping tags', () => {
    expect(countWordsHtml('<p>hello</p>   <p>world</p>')).toBe(2);
  });

  it('returns 0 for only tags', () => {
    expect(countWordsHtml('<div><span></span></div>')).toBe(0);
  });

  it('returns 0 for only whitespace after stripping', () => {
    expect(countWordsHtml('<p>  </p> <br/> ')).toBe(0);
  });
});

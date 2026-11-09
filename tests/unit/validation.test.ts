import { describe, it, expect } from 'vitest';
import { requireText, optionalText, requirePositiveNumber, requireIsoDate } from '../../src/lib/validation';

describe('input validation helpers', () => {
  it('requireText trims, and rejects missing, empty, non-text and too-long values', () => {
    expect(requireText({ a: '  D-1001  ' }, 'a')).toBe('D-1001');
    expect(() => requireText({}, 'a')).toThrow(/required/);
    expect(() => requireText({ a: '   ' }, 'a')).toThrow(/required/);
    expect(() => requireText({ a: 42 }, 'a')).toThrow(/required/);
    expect(() => requireText({ a: 'x'.repeat(51) }, 'a', 50)).toThrow(/at most 50/);
    expect(requireText({ a: 'x'.repeat(50) }, 'a', 50).length).toBe(50);
  });

  it('optionalText returns an empty string when missing and still checks length', () => {
    expect(optionalText({}, 'a')).toBe('');
    expect(optionalText({ a: null }, 'a')).toBe('');
    expect(optionalText({ a: ' ok ' }, 'a')).toBe('ok');
    expect(() => optionalText({ a: 'x'.repeat(60) }, 'a', 50)).toThrow(/at most 50/);
    expect(() => optionalText({ a: 7 }, 'a')).toThrow(/must be text/);
  });

  it('requirePositiveNumber accepts numbers and numeric text, rejects the rest', () => {
    expect(requirePositiveNumber({ a: 8.5 }, 'a')).toBe(8.5);
    expect(requirePositiveNumber({ a: '8.50' }, 'a')).toBe(8.5);
    for (const bad of [0, -1, 'abc', '', null, undefined, Infinity, 1e9]) {
      expect(() => requirePositiveNumber({ a: bad }, 'a')).toThrow(/positive number/);
    }
  });

  it('requireIsoDate accepts real YYYY-MM-DD dates only', () => {
    expect(requireIsoDate({ d: '2026-02-01' }, 'd')).toBe('2026-02-01');
    for (const bad of ['2026-2-1', '01/02/2026', '2026-02-31', '2026-13-01', 'tomorrow', '', 20260201]) {
      expect(() => requireIsoDate({ d: bad }, 'd')).toThrow();
    }
  });
});
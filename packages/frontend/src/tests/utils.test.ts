import { describe, expect, it } from 'vitest';
import { cn, formatDate, formatRelativeTime } from '../lib/utils';

describe('cn utility', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
    expect(cn('foo', true && 'bar', 'baz')).toBe('foo bar baz');
  });

  it('should handle tailwind conflicts', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });
});

describe('formatDate', () => {
  it('should format date string', () => {
    const result = formatDate('2024-03-15');
    expect(result).toContain('15');
    expect(result).toContain('2024');
  });

  it('should format Date object', () => {
    const result = formatDate(new Date('2024-03-15'));
    expect(result).toContain('15');
    expect(result).toContain('2024');
  });
});

describe('formatRelativeTime', () => {
  it('should return "agora" for recent times', () => {
    const now = new Date();
    expect(formatRelativeTime(now)).toBe('agora');
  });

  it('should return minutes for times within an hour', () => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    expect(formatRelativeTime(thirtyMinutesAgo)).toMatch(/\d+min atrás/);
  });

  it('should return hours for times within a day', () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    expect(formatRelativeTime(fiveHoursAgo)).toMatch(/\d+h atrás/);
  });

  it('should return days for times within a week', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(threeDaysAgo)).toMatch(/\d+d atrás/);
  });
});





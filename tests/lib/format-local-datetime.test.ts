import { describe, expect, it } from 'vitest';
import { formatLocalDate, formatLocalDateTime, formatLocalTime } from '@/lib/format-local-datetime';

describe('formatLocalDateTime', () => {
  it('formats date and time in the local timezone', () => {
    const value = new Date(2026, 6, 29, 18, 45, 0);
    expect(formatLocalDate(value)).toBe('29 Jul 2026');
    expect(formatLocalTime(value)).toBe('6:45 PM');
    expect(formatLocalDateTime(value)).toBe('29 Jul 2026 • 6:45 PM');
  });

  it('returns an empty string for invalid input', () => {
    expect(formatLocalDateTime('not-a-date')).toBe('');
  });
});

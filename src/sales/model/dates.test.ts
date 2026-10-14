import { describe, expect, it } from 'vitest';
import { formatWhen } from './dates';

describe('formatWhen', () => {
  it('writes the moment in the shop\'s time, which is Bogotá time (UTC-5), not the browser\'s', () => {
    const text = formatWhen('2026-10-14T15:00:00Z');
    expect(text).toContain('2026');
    expect(text).toMatch(/10:00/);
    expect(text).not.toMatch(/15:00|3:00/);
  });

  it('crosses midnight the way Bogotá does', () => {
    expect(formatWhen('2026-10-15T03:30:00Z')).toMatch(/14/);
  });

  it('shows what it cannot read as it came, instead of "Invalid Date"', () => {
    expect(formatWhen('not a date')).toBe('not a date');
  });
});

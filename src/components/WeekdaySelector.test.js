import { describe, it, expect } from 'vitest';
import { weekdaysLabel } from './WeekdaySelector.jsx';

describe('weekdaysLabel', () => {
  it('formats selected days in Mo-So order regardless of input order', () => {
    expect(weekdaysLabel(['Fr', 'Mo', 'Mi'])).toBe('3x wöchentlich (Mo, Mi, Fr)');
  });

  it('returns an empty string when nothing is selected', () => {
    expect(weekdaysLabel([])).toBe('');
    expect(weekdaysLabel(undefined)).toBe('');
  });

  it('counts a single day correctly', () => {
    expect(weekdaysLabel(['Di'])).toBe('1x wöchentlich (Di)');
  });
});

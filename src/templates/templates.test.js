import { describe, it, expect } from 'vitest';
import { cloneTemplate, newEmptyRow, newSection, cloneOptionalSection } from './templates.js';

describe('templates.js', () => {
  it('clones the winterdienst template with fresh row/section ids', () => {
    const a = cloneTemplate('winterdienst');
    const b = cloneTemplate('winterdienst');
    expect(a.length).toBeGreaterThan(0);
    expect(a[0].id).not.toBe(b[0].id);
    expect(a[0].rows[0].id).not.toBe(b[0].rows[0].id);
  });

  it('returns an empty array for an unknown template key', () => {
    expect(cloneTemplate('does-not-exist')).toEqual([]);
  });

  it('newEmptyRow has the expected default shape', () => {
    const row = newEmptyRow();
    expect(row).toMatchObject({ text: '', bedarf: false, intervalColumn: '', intervalValue: '', bemerkung: '' });
    expect(row.wochentage).toEqual([]);
  });

  it('newSection wraps a single empty row', () => {
    const section = newSection('Testbereich');
    expect(section.title).toBe('Testbereich');
    expect(section.rows.length).toBe(1);
  });

  it('cloneOptionalSection returns null for unknown keys', () => {
    expect(cloneOptionalSection('unknown')).toBeNull();
  });

  it('cloneOptionalSection clones a known optional service', () => {
    const s = cloneOptionalSection('grundreinigung');
    expect(s.title).toContain('Grundreinigung');
    expect(s.rows.length).toBeGreaterThan(0);
  });
});

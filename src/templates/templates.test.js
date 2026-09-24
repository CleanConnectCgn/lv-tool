import { describe, it, expect } from 'vitest';
import {
  cloneTemplate,
  newEmptyRow,
  newSection,
  cloneOptionalSection,
  computeIntervalSummary,
  buildIntervalSelectOptions,
  intervalPatchFromSelectValue,
} from './templates.js';

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

  describe('computeIntervalSummary', () => {
    it('nimmt das Maximum, wenn Zeilen mit unterschiedlicher Häufigkeit gemischt sind', () => {
      const sections = [
        {
          rows: [
            { text: 'Böden wischen', bedarf: false, intervalColumn: 'woechentlich', intervalValue: '1x' },
            { text: 'Staubsaugen', bedarf: false, intervalColumn: 'woechentlich', intervalValue: '2x' },
          ],
        },
      ];
      expect(computeIntervalSummary(sections)).toBe('2x wöchentlich');
    });

    it('ignoriert Bedarfs-Zeilen und leere Zeilen', () => {
      const sections = [
        {
          rows: [
            { text: 'Fenster putzen', bedarf: true, intervalColumn: '', intervalValue: '' },
            { text: '', bedarf: false, intervalColumn: 'woechentlich', intervalValue: '5x' },
            { text: 'Böden wischen', bedarf: false, intervalColumn: 'woechentlich', intervalValue: '2x' },
          ],
        },
      ];
      expect(computeIntervalSummary(sections)).toBe('2x wöchentlich');
    });

    it('greift auf monatlich/jährlich zurück, wenn keine wöchentlichen Zeilen vorhanden sind', () => {
      const sections = [{ rows: [{ text: 'Grundreinigung', bedarf: false, intervalColumn: 'jaehrlich', intervalValue: '2x' }] }];
      expect(computeIntervalSummary(sections)).toBe('2x jährlich');
    });

    it('gibt einen leeren String zurück, wenn kein Intervall bestimmbar ist', () => {
      expect(computeIntervalSummary([])).toBe('');
      expect(computeIntervalSummary([{ rows: [{ text: 'X', bedarf: true }] }])).toBe('');
    });
  });

  describe('buildIntervalSelectOptions / intervalPatchFromSelectValue', () => {
    it('bilden sich gegenseitig ab: jeder Options-Wert lässt sich zurück in ein Patch wandeln', () => {
      buildIntervalSelectOptions({ includeBedarf: true }).forEach((o) => {
        const patch = intervalPatchFromSelectValue(o.value);
        expect(patch).toHaveProperty('bedarf');
        expect(patch).toHaveProperty('intervalColumn');
        expect(patch).toHaveProperty('intervalValue');
      });
    });

    it('lässt "Bei Bedarf" standardmäßig weg, nur mit includeBedarf dabei', () => {
      expect(buildIntervalSelectOptions().some((o) => o.value === 'bedarf')).toBe(false);
      expect(buildIntervalSelectOptions({ includeBedarf: true }).some((o) => o.value === 'bedarf')).toBe(true);
    });

    it('leerer Wert löscht Intervall und Bedarf', () => {
      expect(intervalPatchFromSelectValue('')).toEqual({ bedarf: false, intervalColumn: '', intervalValue: '' });
    });

    it('"bedarf" setzt Bei Bedarf und löscht das Intervall', () => {
      expect(intervalPatchFromSelectValue('bedarf')).toEqual({ bedarf: true, intervalColumn: '', intervalValue: '' });
    });

    it('"spalte:wert" setzt Spalte und Wert, Bedarf aus', () => {
      expect(intervalPatchFromSelectValue('woechentlich:3x')).toEqual({
        bedarf: false,
        intervalColumn: 'woechentlich',
        intervalValue: '3x',
      });
      expect(intervalPatchFromSelectValue('aufAnfrage:Ja')).toEqual({
        bedarf: false,
        intervalColumn: 'aufAnfrage',
        intervalValue: 'Ja',
      });
    });
  });
});

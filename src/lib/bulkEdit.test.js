import { describe, it, expect } from 'vitest';
import { applyBulkInterval, deleteSelected } from './bulkEdit.js';

function lv() {
  return [
    {
      id: 's1',
      title: 'Sanitärbereiche',
      rows: [
        { id: 'r1', text: 'WC reinigen', intervalColumn: 'woechentlich', intervalValue: '2x', bedarf: false },
        { id: 'r2', text: 'Spiegel reinigen', intervalColumn: 'woechentlich', intervalValue: '1x', bedarf: false },
      ],
    },
    {
      id: 's2',
      title: 'Büroräume',
      rows: [
        { id: 'r3', text: 'Böden wischen', intervalColumn: 'woechentlich', intervalValue: '2x', bedarf: false },
        { id: 'r4', text: 'Staub wischen', intervalColumn: '', intervalValue: '', bedarf: true },
      ],
    },
  ];
}

describe('applyBulkInterval', () => {
  it('setzt das Intervall nur bei den markierten Zeilen, über Bereiche hinweg', () => {
    const out = applyBulkInterval(lv(), new Set(['r1', 'r3']), 'monatlich:3x');
    expect(out[0].rows[0]).toMatchObject({ intervalColumn: 'monatlich', intervalValue: '3x', bedarf: false });
    // nicht markiert - bleibt unverändert
    expect(out[0].rows[1]).toMatchObject({ intervalColumn: 'woechentlich', intervalValue: '1x' });
    expect(out[1].rows[0]).toMatchObject({ intervalColumn: 'monatlich', intervalValue: '3x' });
  });

  it('setzt "Bei Bedarf" für markierte Zeilen', () => {
    const out = applyBulkInterval(lv(), new Set(['r1']), 'bedarf');
    expect(out[0].rows[0]).toMatchObject({ bedarf: true, intervalColumn: '', intervalValue: '' });
  });

  it('tut nichts ohne markierte Zeilen', () => {
    const input = lv();
    expect(applyBulkInterval(input, new Set(), 'woechentlich:2x')).toBe(input);
  });

  it('tut nichts ohne gewählten Intervallwert', () => {
    const input = lv();
    expect(applyBulkInterval(input, new Set(['r1']), '')).toBe(input);
  });

  it('verändert das Original nicht', () => {
    const input = lv();
    applyBulkInterval(input, new Set(['r1']), 'jaehrlich:1x');
    expect(input[0].rows[0].intervalValue).toBe('2x');
  });
});

describe('deleteSelected', () => {
  it('entfernt nur markierte Zeilen', () => {
    const out = deleteSelected(lv(), new Set(['r2']), new Set());
    expect(out[0].rows.map((r) => r.id)).toEqual(['r1']);
    expect(out[1].rows).toHaveLength(2);
  });

  it('entfernt einen markierten Bereich komplett, auch ohne einzeln markierte Zeilen', () => {
    const out = deleteSelected(lv(), new Set(), new Set(['s2']));
    expect(out.map((s) => s.id)).toEqual(['s1']);
  });

  it('kombiniert Zeilen- und Bereichslöschung in einem Schritt', () => {
    const out = deleteSelected(lv(), new Set(['r1']), new Set(['s2']));
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('s1');
    expect(out[0].rows.map((r) => r.id)).toEqual(['r2']);
  });

  it('tut nichts ohne jede Markierung', () => {
    const input = lv();
    expect(deleteSelected(input, new Set(), new Set())).toBe(input);
  });

  it('verändert das Original nicht', () => {
    const input = lv();
    deleteSelected(input, new Set(['r1']), new Set());
    expect(input[0].rows).toHaveLength(2);
  });
});

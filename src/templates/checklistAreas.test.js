import { describe, it, expect } from 'vitest';
import { buildSectionsFromSetup, buildSingleServiceMain, AREA_ORDER } from './checklistAreas.js';

describe('buildSectionsFromSetup', () => {
  it('fills empty woechentlich rows with the chosen frequency and weekdays', () => {
    const { main } = buildSectionsFromSetup({
      frequency: '3x',
      wochentage: ['Mo', 'Mi', 'Fr'],
      areas: { flur: true },
    });
    const flurSection = main.find((s) => s.title === 'Flur- und Verkehrsbereich');
    expect(flurSection).toBeTruthy();
    const weeklyRow = flurSection.rows.find((r) => r.intervalColumn === 'woechentlich');
    expect(weeklyRow.intervalValue).toBe('3x');
    expect(weeklyRow.wochentage).toEqual(['Mo', 'Mi', 'Fr']);
  });

  it('only includes areas that are toggled on', () => {
    const { main } = buildSectionsFromSetup({ frequency: '2x', areas: {} });
    expect(main.length).toBe(0);
  });

  it('produces a glasreinigung child document when enabled', () => {
    const { children } = buildSectionsFromSetup({
      frequency: '2x',
      areas: {},
      glas: { enabled: true, rahmen: false, lamellen: false },
    });
    expect(children.some((c) => c.docType === 'glasreinigung')).toBe(true);
  });
});

describe('buildSingleServiceMain', () => {
  it('builds a standalone Glasreinigung LV without any Unterhaltsreinigung basis', () => {
    const { main, lvTitle } = buildSingleServiceMain('glasreinigung');
    expect(lvTitle).toBe('Leistungsverzeichnis Glasreinigung');
    expect(main.length).toBe(1);
    expect(main[0].title).toBe('Glasreinigung');
    expect(main[0].rows.length).toBeGreaterThan(0);
  });

  it('builds a standalone Grundreinigung LV', () => {
    const { main, lvTitle } = buildSingleServiceMain('grundreinigung');
    expect(lvTitle).toBe('Leistungsverzeichnis Grundreinigung');
    expect(main[0].title).toBe('Grundreinigung');
  });

  it('builds a free-text "sonstiges" LV with the given title', () => {
    const { main, lvTitle } = buildSingleServiceMain('sonstiges', 'Teppichreinigung');
    expect(lvTitle).toBe('Leistungsverzeichnis Teppichreinigung');
    expect(main[0].title).toBe('Teppichreinigung');
  });

  it('falls back to a generic title for "sonstiges" without custom text', () => {
    const { lvTitle } = buildSingleServiceMain('sonstiges', '');
    expect(lvTitle).toBe('Leistungsverzeichnis Sonstige Leistung');
  });

  it('produces a winterdienst child document from the winterdienst template', () => {
    const { children } = buildSectionsFromSetup({ frequency: '2x', areas: {}, winterdienst: true });
    const wd = children.find((c) => c.docType === 'winterdienst');
    expect(wd).toBeTruthy();
    expect(wd.sections.length).toBeGreaterThan(0);
  });

  it('covers every declared area key', () => {
    const areas = Object.fromEntries(AREA_ORDER.map((k) => [k, true]));
    const { main } = buildSectionsFromSetup({ frequency: '1x', areas });
    expect(main.length).toBe(AREA_ORDER.length);
  });
});

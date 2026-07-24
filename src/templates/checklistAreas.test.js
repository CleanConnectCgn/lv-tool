import { describe, it, expect } from 'vitest';
import { buildSectionsFromSetup, AREA_ORDER } from './checklistAreas.js';

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

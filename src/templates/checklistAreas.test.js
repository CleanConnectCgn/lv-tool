import { describe, it, expect } from 'vitest';
import {
  buildSectionsFromSetup,
  buildSingleServiceMain,
  getMissingRowsForSection,
  AREA_ORDER,
  AREA_DEFINITIONS,
  OBJEKT_TYPEN,
  areasForObjektTyp,
} from './checklistAreas.js';

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

describe('getMissingRowsForSection', () => {
  function bereichMitFrequenz(key, freq) {
    const s = AREA_DEFINITIONS[key].build();
    s.rows = s.rows.map((r) =>
      r.intervalColumn === 'woechentlich' && !r.intervalValue ? { ...r, intervalValue: freq } : r
    );
    return s;
  }

  it('schlägt genau die fehlenden Katalogzeilen vor', () => {
    const s = bereichMitFrequenz('treppenhaus', '2x');
    const entfernt = s.rows.shift();
    const fehlend = getMissingRowsForSection(s);
    expect(fehlend.map((r) => r.text)).toEqual([entfernt.text]);
  });

  it('übernimmt für die vorgeschlagene Zeile die im Bereich übliche Frequenz', () => {
    // Ohne diesen Schritt käme die Zeile mit leerem Intervall in den Editor
    // und stünde dort als "kein Intervall".
    const s = bereichMitFrequenz('treppenhaus', '3x');
    s.rows.shift();
    const [vorschlag] = getMissingRowsForSection(s);
    expect(vorschlag.intervalColumn).toBe('woechentlich');
    expect(vorschlag.intervalValue).toBe('3x');
  });

  it('schlägt nichts vor, wenn der Bereich vollständig ist', () => {
    expect(getMissingRowsForSection(bereichMitFrequenz('sanitaer', '2x'))).toEqual([]);
  });

  it('schlägt nichts vor für einen Bereich, den der Katalog nicht kennt', () => {
    expect(getMissingRowsForSection({ title: 'Bootssteg', rows: [] })).toEqual([]);
  });

  it('erkennt einen umbenannten Bereich über den Teiltreffer', () => {
    const s = bereichMitFrequenz('sanitaer', '2x');
    s.title = 'Sanitärbereiche EG';
    s.rows.shift();
    expect(getMissingRowsForSection(s)).toHaveLength(1);
  });
});

describe('Objekttypen', () => {
  it('hakt für eine Wohnanlage genau die WEG-Bereiche an', () => {
    const areas = areasForObjektTyp('wohnanlage');
    expect(areas.eingangsbereich).toBe(true);
    expect(areas.hausmeisterservice).toBe(true);
    expect(areas.behandlungsraeume).toBe(false);
  });

  it('liefert für einen unbekannten Typ alle Bereiche abgewählt', () => {
    const areas = areasForObjektTyp('raumstation');
    expect(Object.values(areas).every((v) => v === false)).toBe(true);
  });

  it('verweist nur auf Bereiche, die es wirklich gibt', () => {
    Object.values(OBJEKT_TYPEN).forEach((typ) => {
      typ.areas.forEach((key) => expect(AREA_ORDER).toContain(key));
    });
  });
});

describe('Sprache im Katalog', () => {
  it('sichert nirgends eine Desinfektion zu', () => {
    AREA_ORDER.forEach((key) => {
      const s = AREA_DEFINITIONS[key].build();
      s.rows.forEach((r) => {
        expect(`${r.text} ${r.beschreibung} ${r.bemerkung}`.toLowerCase()).not.toContain('desinfizier');
      });
    });
  });

  it('gibt jeder Katalogzeile eine ausformulierte Leistungsbeschreibung', () => {
    AREA_ORDER.forEach((key) => {
      const s = AREA_DEFINITIONS[key].build();
      s.rows.forEach((r) => {
        expect(r.beschreibung, `${key} / ${r.text}`).toBeTruthy();
      });
    });
  });
});

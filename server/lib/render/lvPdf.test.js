import { describe, it, expect } from 'vitest';
import { catalogItemDisplayText, groupItems, renderLvPdf } from './lvPdf.js';

const SANITAER = { id: 'ra-sanitaer', name: 'Sanitär', sortOrder: 0 };
const FLURE = { id: 'ra-flure', name: 'Flure und Treppenhäuser', sortOrder: 1 };
const BODEN = { id: 'eg-boden', name: 'Boden', sortOrder: 0 };
const WAND = { id: 'eg-wand', name: 'Wand', sortOrder: 1 };
const ABFALL = { id: 'eg-abfall', name: 'Abfall', sortOrder: 2 };

describe('catalogItemDisplayText', () => {
  it('setzt Gegenstand, Verb (lesbar) und Zusatz zusammen', () => {
    expect(
      catalogItemDisplayText({ gegenstand: 'Hartboden', verb: 'FEUCHT_WISCHEN', zusatz: null })
    ).toBe('Hartboden feucht wischen');
    expect(
      catalogItemDisplayText({ gegenstand: 'Abfallbehälter', verb: 'ENTLEEREN_UND_ENTSORGEN', zusatz: 'inkl. Beutel' })
    ).toBe('Abfallbehälter entleeren und entsorgen (inkl. Beutel)');
  });
});

describe('groupItems', () => {
  it('gliedert nach Raumbereich (sortOrder), darin nach Elementgruppe in fester Reihenfolge', () => {
    const items = [
      { catalogItemId: 'c1', roomAreaId: 'ra-flure', roomArea: FLURE, catalogItem: { gegenstand: 'X', verb: 'ENTSTAUBEN', elementGroup: WAND } },
      { catalogItemId: 'c2', roomAreaId: 'ra-sanitaer', roomArea: SANITAER, catalogItem: { gegenstand: 'Abfallbehälter', verb: 'ENTLEEREN_UND_ENTSORGEN', elementGroup: ABFALL } },
      { catalogItemId: 'c3', roomAreaId: 'ra-sanitaer', roomArea: SANITAER, catalogItem: { gegenstand: 'Hartboden', verb: 'FEUCHT_WISCHEN', elementGroup: BODEN } },
    ];
    const groups = groupItems(items);
    expect(groups.map((g) => g.roomArea.name)).toEqual(['Sanitär', 'Flure und Treppenhäuser']);
    // Innerhalb Sanitär: Boden (sortOrder 0) vor Abfall (sortOrder 2).
    expect(groups[0].items.map((i) => i.catalogItem.gegenstand)).toEqual(['Hartboden', 'Abfallbehälter']);
  });

  it('reduziert identische Positionen innerhalb eines Abschnitts auf eine Zeile', () => {
    const item = {
      catalogItemId: 'c1',
      roomAreaId: 'ra-sanitaer',
      roomArea: SANITAER,
      catalogItem: { gegenstand: 'Hartboden', verb: 'FEUCHT_WISCHEN', elementGroup: BODEN },
      nachBedarf: false,
      woechentlich: 2,
      monatlich: null,
      jaehrlich: null,
      bemerkung: '',
    };
    const groups = groupItems([item, { ...item }, { ...item }]);
    expect(groups[0].items).toHaveLength(1);
  });

  it('dedupliziert NICHT, wenn sich nur "einmalig" unterscheidet (Regressionstest)', () => {
    // Ergänzt 2026-07-29 zusammen mit dem einmalig-Feld: eine reguläre und
    // eine einmalige Position mit sonst identischen Werten dürfen nicht zu
    // einer Zeile verschmolzen werden.
    const base = {
      catalogItemId: 'c1',
      roomAreaId: 'ra-sanitaer',
      roomArea: SANITAER,
      catalogItem: { gegenstand: 'Hartboden', verb: 'FEUCHT_WISCHEN', elementGroup: BODEN },
      nachBedarf: false,
      woechentlich: null,
      monatlich: null,
      jaehrlich: null,
      bemerkung: '',
    };
    const groups = groupItems([
      { ...base, woechentlich: 2, einmalig: false },
      { ...base, einmalig: true },
    ]);
    expect(groups[0].items).toHaveLength(2);
  });

  it('behält unterschiedliche Intervalle derselben Position als getrennte Zeilen', () => {
    const base = {
      catalogItemId: 'c1',
      roomAreaId: 'ra-sanitaer',
      roomArea: SANITAER,
      catalogItem: { gegenstand: 'Hartboden', verb: 'FEUCHT_WISCHEN', elementGroup: BODEN },
      nachBedarf: false,
      monatlich: null,
      jaehrlich: null,
      bemerkung: '',
    };
    const groups = groupItems([{ ...base, woechentlich: 1 }, { ...base, woechentlich: 2 }]);
    expect(groups[0].items).toHaveLength(2);
  });
});

describe('renderLvPdf', () => {
  it('erzeugt ein gültiges, mehrseitiges PDF für mehrere Objekt-Abschnitte', () => {
    const item = {
      catalogItemId: 'c1',
      roomAreaId: 'ra-sanitaer',
      roomArea: SANITAER,
      catalogItem: { gegenstand: 'Hartboden', verb: 'FEUCHT_WISCHEN', zusatz: null, elementGroup: BODEN },
      nachBedarf: false,
      woechentlich: 2,
      monatlich: null,
      jaehrlich: null,
      bemerkung: 'Testbemerkung',
    };
    const specs = [
      {
        leistungsart: 'Unterhaltsreinigung',
        standDatum: new Date('2026-01-15'),
        items: [item],
        object: { street: 'Teststraße 1', zip: '50667', city: 'Köln', customer: { name: 'Test GmbH' } },
      },
      {
        leistungsart: 'Glasreinigung',
        standDatum: new Date('2026-01-15'),
        items: [item],
        object: { street: 'Zweigstraße 2', zip: '50668', city: 'Köln', customer: { name: 'Test GmbH' } },
      },
    ];
    const buffer = renderLvPdf(specs);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.toString('latin1', 0, 8)).toBe('%PDF-1.3');
  });

  it('rendert eine echte einmalige Position (z.B. Grundreinigung), ohne zu werfen', () => {
    const item = {
      catalogItemId: 'c1',
      roomAreaId: 'ra-sanitaer',
      roomArea: SANITAER,
      catalogItem: { gegenstand: 'Hartboden', verb: 'FEUCHT_WISCHEN', zusatz: null, elementGroup: BODEN },
      nachBedarf: false,
      einmalig: true,
      woechentlich: null,
      monatlich: null,
      jaehrlich: null,
      bemerkung: 'Einzugsreinigung',
    };
    const buffer = renderLvPdf([
      {
        leistungsart: 'Grundreinigung',
        standDatum: new Date('2026-07-01'),
        items: [item],
        object: { street: 'Teststraße 1', zip: '50667', city: 'Köln', customer: { name: 'Test GmbH' } },
      },
    ]);
    expect(buffer.toString('latin1', 0, 8)).toBe('%PDF-1.3');
  });

  it('erzeugt auch ohne Positionen ein valides (leeres) PDF statt abzustürzen', () => {
    const buffer = renderLvPdf([
      {
        leistungsart: 'Unterhaltsreinigung',
        standDatum: new Date(),
        items: [],
        object: { street: 'X', zip: '1', city: 'Y', customer: { name: 'Z' } },
      },
    ]);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

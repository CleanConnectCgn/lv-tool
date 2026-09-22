import { describe, it, expect } from 'vitest';
import { validateAktionen, validateSetup, extractJson } from './lvAssistant.js';

const sections = [
  {
    title: 'Sanitärbereiche',
    rows: [{ text: 'WC Fliesenwände reinigen' }, { text: 'Abfallbehälter leeren inkl. Austausch der Beutel' }],
  },
  { title: 'Büroräume', rows: [{ text: 'Hartböden feucht wischen & Textilbeläge saugen' }] },
];
const katalogTexte = ['Waschbecken, Armaturen & Wandspiegel reinigen', 'Feuchte Reinigung der Fußleisten'];
const areaKeys = ['kueche', 'aufzug'];
const ctx = { sections, katalogTexte, areaKeys };

describe('validateAktionen', () => {
  it('lässt eine Intervalländerung auf einer vorhandenen Zeile durch', () => {
    const out = validateAktionen(
      [
        {
          typ: 'intervall_aendern',
          bereich: 'Sanitärbereiche',
          zeile: 'WC Fliesenwände reinigen',
          intervalColumn: 'woechentlich',
          intervalValue: '3x',
        },
      ],
      ctx
    );
    expect(out).toHaveLength(1);
  });

  it('lässt eine Intervalländerung für den ganzen Bereich durch (zeile = null)', () => {
    const out = validateAktionen(
      [
        {
          typ: 'intervall_aendern',
          bereich: 'Büroräume',
          zeile: null,
          intervalColumn: 'woechentlich',
          intervalValue: '2x',
        },
      ],
      ctx
    );
    expect(out).toHaveLength(1);
  });

  it('verwirft eine Änderung an einem Bereich, den es im LV nicht gibt', () => {
    const out = validateAktionen(
      [
        {
          typ: 'intervall_aendern',
          bereich: 'Dachterrasse',
          zeile: null,
          intervalColumn: 'woechentlich',
          intervalValue: '1x',
        },
      ],
      ctx
    );
    expect(out).toHaveLength(0);
  });

  it('verwirft das Entfernen einer Zeile, die es in diesem Bereich nicht gibt', () => {
    const out = validateAktionen(
      [{ typ: 'zeile_entfernen', bereich: 'Büroräume', zeile: 'WC Fliesenwände reinigen' }],
      ctx
    );
    expect(out).toHaveLength(0);
  });

  it('erlaubt nur Zeilen aus dem Katalog, keine frei erfundenen Leistungen', () => {
    const out = validateAktionen(
      [
        { typ: 'zeile_hinzufuegen', bereich: 'Sanitärbereiche', katalogText: 'Waschbecken, Armaturen & Wandspiegel reinigen' },
        { typ: 'zeile_hinzufuegen', bereich: 'Sanitärbereiche', katalogText: 'Fenster mit Spezialdrohne reinigen' },
      ],
      ctx
    );
    expect(out).toHaveLength(1);
    expect(out[0].katalogText).toBe('Waschbecken, Armaturen & Wandspiegel reinigen');
  });

  it('erlaubt nur Bereiche, die es im Katalog gibt', () => {
    const out = validateAktionen(
      [
        { typ: 'bereich_hinzufuegen', areaKey: 'aufzug' },
        { typ: 'bereich_hinzufuegen', areaKey: 'swimmingpool' },
      ],
      ctx
    );
    expect(out).toHaveLength(1);
    expect(out[0].areaKey).toBe('aufzug');
  });

  it('verwirft unbekannte Aktionstypen', () => {
    const out = validateAktionen(
      [
        { typ: 'preis_setzen', bereich: 'Büroräume', betrag: 500 },
        { typ: 'alles_loeschen' },
      ],
      ctx
    );
    expect(out).toHaveLength(0);
  });

  it('verwirft ein Intervall mit unbekannter Spalte', () => {
    const out = validateAktionen(
      [
        {
          typ: 'intervall_aendern',
          bereich: 'Büroräume',
          zeile: null,
          intervalColumn: 'stuendlich',
          intervalValue: '4x',
        },
      ],
      ctx
    );
    expect(out).toHaveLength(0);
  });

  it('kommt mit fehlenden oder kaputten Eingaben klar', () => {
    expect(validateAktionen(null, ctx)).toEqual([]);
    expect(validateAktionen(undefined, ctx)).toEqual([]);
    expect(validateAktionen('keine liste', ctx)).toEqual([]);
    expect(validateAktionen([null, 42, 'x'], ctx)).toEqual([]);
  });
});

describe('extractJson', () => {
  it('liest JSON auch aus einem Markdown-Codeblock', () => {
    const raw = '```json\n{"antwort":"ok","aktionen":[]}\n```';
    expect(extractJson(raw)).toEqual({ antwort: 'ok', aktionen: [] });
  });

  it('gibt ein leeres Objekt zurück, wenn nichts da ist', () => {
    expect(extractJson('')).toEqual({});
  });
});

describe('validateSetup', () => {
  const ctx = { areaKeys: ['flur', 'buero', 'sanitaer'], typKeys: ['buero', 'praxis'] };

  it('übernimmt nur Bereiche und Typen, die es wirklich gibt', () => {
    const out = validateSetup(
      { objektTyp: 'praxis', frequenz: '3x', areas: ['flur', 'dachterrasse', 'sanitaer'], glas: true },
      ctx
    );
    expect(out.objektTyp).toBe('praxis');
    expect(out.areas).toEqual(['flur', 'sanitaer']);
    expect(out.glas).toBe(true);
  });

  it('verwirft einen erfundenen Objekttyp', () => {
    expect(validateSetup({ objektTyp: 'raumstation' }, ctx).objektTyp).toBe('');
  });

  it('nimmt nur plausible Frequenzen', () => {
    expect(validateSetup({ frequenz: '5x' }, ctx).frequenz).toBe('5x');
    expect(validateSetup({ frequenz: '99x' }, ctx).frequenz).toBe('');
    expect(validateSetup({ frequenz: 'täglich' }, ctx).frequenz).toBe('');
  });

  it('kommt mit einer leeren Antwort klar', () => {
    const out = validateSetup({}, ctx);
    expect(out).toEqual({ objektTyp: '', frequenz: '', areas: [], glas: false, winterdienst: false, hinweis: '' });
  });
});

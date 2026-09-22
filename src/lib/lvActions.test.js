import { describe, it, expect } from 'vitest';
import { applyAktion, applyAktionen, describeAktion, haeufigsteWochenfrequenz } from './lvActions.js';

function lv() {
  return [
    {
      id: 's1',
      title: 'Sanitärbereiche',
      rows: [
        { id: 'r1', text: 'WC Fliesenwände reinigen', intervalColumn: 'woechentlich', intervalValue: '2x', bedarf: false, bemerkung: '' },
        { id: 'r2', text: 'Staub & Spinnweben', intervalColumn: '', intervalValue: '', bedarf: true, bemerkung: '' },
      ],
    },
    {
      id: 's2',
      title: 'Büroräume',
      rows: [
        { id: 'r3', text: 'Hartböden feucht wischen & Textilbeläge saugen', intervalColumn: 'woechentlich', intervalValue: '2x', bedarf: false, bemerkung: '' },
      ],
    },
  ];
}

describe('applyAktion', () => {
  it('ändert das Intervall einer einzelnen Zeile', () => {
    const out = applyAktion(lv(), {
      typ: 'intervall_aendern',
      bereich: 'Sanitärbereiche',
      zeile: 'WC Fliesenwände reinigen',
      intervalColumn: 'woechentlich',
      intervalValue: '3x',
    });
    expect(out[0].rows[0].intervalValue).toBe('3x');
    // Die andere Zeile bleibt unangetastet.
    expect(out[0].rows[1].bedarf).toBe(true);
  });

  it('lässt "Bei Bedarf"-Zeilen in Ruhe, wenn ein ganzer Bereich umgestellt wird', () => {
    const out = applyAktion(lv(), {
      typ: 'intervall_aendern',
      bereich: 'Sanitärbereiche',
      zeile: null,
      intervalColumn: 'woechentlich',
      intervalValue: '5x',
    });
    expect(out[0].rows[0].intervalValue).toBe('5x');
    expect(out[0].rows[1].bedarf).toBe(true);
    expect(out[0].rows[1].intervalValue).toBe('');
  });

  it('entfernt eine Zeile', () => {
    const out = applyAktion(lv(), {
      typ: 'zeile_entfernen',
      bereich: 'Sanitärbereiche',
      zeile: 'WC Fliesenwände reinigen',
    });
    expect(out[0].rows).toHaveLength(1);
  });

  it('fügt eine Katalogzeile samt ausformulierter Beschreibung hinzu', () => {
    const out = applyAktion(lv(), {
      typ: 'zeile_hinzufuegen',
      bereich: 'Sanitärbereiche',
      katalogText: 'Waschbecken, Armaturen & Wandspiegel reinigen',
    });
    const neu = out[0].rows.at(-1);
    expect(neu.text).toBe('Waschbecken, Armaturen & Wandspiegel reinigen');
    expect(neu.beschreibung).toMatch(/Kalkansätzen/);
    // Übernimmt die im LV übliche Frequenz statt einer erfundenen.
    expect(neu.intervalValue).toBe('2x');
  });

  it('fügt einen ganzen Bereich mit der im LV üblichen Frequenz hinzu', () => {
    const out = applyAktion(lv(), { typ: 'bereich_hinzufuegen', areaKey: 'aufzug' });
    expect(out).toHaveLength(3);
    expect(out[2].title).toBe('Aufzug');
    const woechentlich = out[2].rows.filter((r) => r.intervalColumn === 'woechentlich');
    expect(woechentlich.every((r) => r.intervalValue === '2x')).toBe(true);
  });

  it('entfernt einen Bereich', () => {
    const out = applyAktion(lv(), { typ: 'bereich_entfernen', bereich: 'Büroräume' });
    expect(out.map((s) => s.title)).toEqual(['Sanitärbereiche']);
  });

  it('setzt eine Bemerkung', () => {
    const out = applyAktion(lv(), {
      typ: 'bemerkung_setzen',
      bereich: 'Büroräume',
      zeile: 'Hartböden feucht wischen & Textilbeläge saugen',
      text: 'Nur EG.',
    });
    expect(out[1].rows[0].bemerkung).toBe('Nur EG.');
  });

  it('gibt den Titel über meta zurück, statt die Bereiche anzufassen', () => {
    const meta = {};
    const out = applyAktion(lv(), { typ: 'titel_setzen', titel: 'Leistungsverzeichnis Glasreinigung' }, meta);
    expect(meta.lvTitle).toBe('Leistungsverzeichnis Glasreinigung');
    expect(out).toHaveLength(2);
  });

  it('verändert das Original nicht', () => {
    const original = lv();
    applyAktion(original, {
      typ: 'zeile_entfernen',
      bereich: 'Sanitärbereiche',
      zeile: 'WC Fliesenwände reinigen',
    });
    expect(original[0].rows).toHaveLength(2);
  });

  it('ignoriert eine Aktion auf einen Bereich, den es nicht gibt', () => {
    const out = applyAktion(lv(), { typ: 'bereich_entfernen', bereich: 'Dachgarten' });
    expect(out).toHaveLength(2);
  });
});

describe('applyAktionen', () => {
  it('wendet mehrere Änderungen nacheinander an', () => {
    const out = applyAktionen(lv(), [
      { typ: 'bereich_hinzufuegen', areaKey: 'aufzug' },
      { typ: 'bereich_entfernen', bereich: 'Büroräume' },
    ]);
    expect(out.map((s) => s.title)).toEqual(['Sanitärbereiche', 'Aufzug']);
  });
});

describe('haeufigsteWochenfrequenz', () => {
  it('nimmt die häufigste wöchentliche Angabe', () => {
    const sections = [
      { rows: [{ intervalColumn: 'woechentlich', intervalValue: '3x' }, { intervalColumn: 'woechentlich', intervalValue: '3x' }] },
      { rows: [{ intervalColumn: 'woechentlich', intervalValue: '1x' }] },
    ];
    expect(haeufigsteWochenfrequenz(sections)).toBe('3x');
  });

  it('fällt auf den Standard zurück, wenn es keine gibt', () => {
    expect(haeufigsteWochenfrequenz([{ rows: [{ bedarf: true }] }])).toBe('2x');
    expect(haeufigsteWochenfrequenz([])).toBe('2x');
  });
});

describe('describeAktion', () => {
  it('beschreibt Änderungen in verständlichem Deutsch', () => {
    expect(
      describeAktion({
        typ: 'intervall_aendern',
        bereich: 'Sanitärbereiche',
        zeile: null,
        intervalColumn: 'woechentlich',
        intervalValue: '3x',
      })
    ).toBe('alle Zeilen in "Sanitärbereiche" auf 3x wöchentlich setzen');
    expect(describeAktion({ typ: 'bereich_hinzufuegen', areaKey: 'aufzug' })).toBe(
      'Bereich "Aufzug" hinzufügen'
    );
  });
});

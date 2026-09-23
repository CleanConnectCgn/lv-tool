import { describe, it, expect } from 'vitest';
import { pruefeRegeln, alsPruefText } from './lvRegelpruefung.js';

const kopf = { lvTitle: 'Leistungsverzeichnis Unterhaltsreinigung', objekt: 'Musterweg 1, 50667 Köln' };

function zeile(text, extra = {}) {
  return {
    id: Math.random().toString(36).slice(2),
    text,
    bedarf: false,
    intervalColumn: 'woechentlich',
    intervalValue: '2x',
    bemerkung: '',
    beschreibung: 'Feuchte Reinigung einschließlich Entfernung oberflächlicher Verschmutzungen.',
    wochentage: [],
    ...extra,
  };
}

function lv(rows, titel = 'Sanitärbereiche') {
  return [{ id: 's1', title: titel, rows }];
}

describe('pruefeRegeln — Kopfdaten', () => {
  it('meldet einen fehlenden Titel', () => {
    const b = pruefeRegeln(lv([zeile('Hartböden feucht wischen')]), { ...kopf, lvTitle: '' });
    expect(b.some((x) => x.title === 'Kein Titel' && x.type === 'red')).toBe(true);
  });

  it('meldet einen Titel ohne Leistungsart', () => {
    const b = pruefeRegeln(lv([zeile('Hartböden feucht wischen')]), { ...kopf, lvTitle: 'Leistungsverzeichnis' });
    expect(b.some((x) => x.title === 'Titel nennt die Leistungsart nicht')).toBe(true);
  });

  it('meldet ein fehlendes Objekt', () => {
    const b = pruefeRegeln(lv([zeile('Hartböden feucht wischen')]), { ...kopf, objekt: '  ' });
    expect(b.some((x) => x.title === 'Kein Objekt angegeben')).toBe(true);
  });

  it('meldet bei sauberen Kopfdaten nichts dazu', () => {
    const b = pruefeRegeln(lv([zeile('Hartböden feucht wischen')]), kopf);
    expect(b).toEqual([]);
  });
});

describe('pruefeRegeln — Tippfehler', () => {
  it('findet "Ausstausch" und liefert die Korrektur', () => {
    // Dieser Fehler stand so in einem versendeten PDF (Kerpstraße 44).
    const b = pruefeRegeln(lv([zeile('Abfallbehälter leeren inkl. Ausstausch der Beutel')]), kopf);
    const treffer = b.find((x) => x.title.includes('Ausstausch'));
    expect(treffer).toBeTruthy();
    expect(treffer.fix).toBe('Abfallbehälter leeren inkl. Austausch der Beutel');
    expect(treffer.fixType).toBe('replace_row');
  });

  it('findet Fehler auch in Beschreibung und Bemerkung', () => {
    const b = pruefeRegeln(
      lv([zeile('Hartböden feucht wischen', { beschreibung: 'Feuchte Reinugung der Flächen.', bemerkung: 'Gtiffspuren entfernen' })]),
      kopf
    );
    expect(b.some((x) => x.fixType === 'replace_beschreibung' && x.fix === 'Feuchte Reinigung der Flächen.')).toBe(true);
    expect(b.some((x) => x.fixType === 'replace_bemerkung' && x.fix === 'Griffspuren entfernen')).toBe(true);
  });

  it('meldet korrekt geschriebene Wörter nicht', () => {
    const b = pruefeRegeln(lv([zeile('Abfallbehälter leeren inkl. Austausch der Beutel')]), kopf);
    expect(b.filter((x) => x.title.startsWith('Schreibfehler'))).toEqual([]);
  });
});

describe('pruefeRegeln — Desinfektion', () => {
  it('meldet eine zugesicherte Desinfektion und schlägt den Ersatz vor', () => {
    const b = pruefeRegeln(lv([zeile('Lichtschalter & Steckdosenrahmen desinfizierend abwischen')]), kopf);
    const treffer = b.find((x) => x.title === 'Desinfektion zugesichert');
    expect(treffer).toBeTruthy();
    expect(treffer.fix).toBe('Lichtschalter & Steckdosenrahmen feucht abwischen');
  });

  it('erkennt sie auch in der Beschreibung', () => {
    const b = pruefeRegeln(
      lv([zeile('Arbeitsflächen abwischen', { beschreibung: 'Flächen werden desinfiziert.' })]),
      kopf
    );
    expect(b.some((x) => x.title === 'Desinfektion zugesichert')).toBe(true);
  });
});

describe('pruefeRegeln — Duplikate und Widersprüche', () => {
  it('meldet dieselbe Leistung zweimal im selben Bereich', () => {
    const b = pruefeRegeln(lv([zeile('Hartböden feucht wischen'), zeile('Hartböden feucht wischen')]), kopf);
    const treffer = b.find((x) => x.title === 'Doppelte Leistung');
    expect(treffer).toBeTruthy();
    expect(treffer.fixType).toBe('remove_row');
    expect(treffer.targetRowIndex).toBe(1);
  });

  it('ignoriert Groß/Kleinschreibung und Punkt am Ende', () => {
    const b = pruefeRegeln(lv([zeile('Hartböden feucht wischen'), zeile('hartböden feucht wischen.')]), kopf);
    expect(b.some((x) => x.title === 'Doppelte Leistung')).toBe(true);
  });

  it('meldet dieselbe Leistung mit unterschiedlichem Intervall als Widerspruch, nicht als Duplikat', () => {
    const b = pruefeRegeln(
      lv([zeile('Hartböden feucht wischen'), zeile('Hartböden feucht wischen', { intervalValue: '5x' })]),
      kopf
    );
    expect(b.some((x) => x.title === 'Widersprüchliche Intervalle')).toBe(true);
    expect(b.some((x) => x.title === 'Doppelte Leistung')).toBe(false);
  });

  it('meldet dieselbe Leistung in VERSCHIEDENEN Bereichen nicht', () => {
    // Das ist gewollt: Abfallbehälter werden in Büro und Küche geleert.
    const sections = [
      { id: 'a', title: 'Büroräume', rows: [zeile('Abfallbehälter leeren inkl. Austausch der Beutel')] },
      { id: 'b', title: 'Küchenräume', rows: [zeile('Abfallbehälter leeren inkl. Austausch der Beutel')] },
    ];
    const b = pruefeRegeln(sections, kopf);
    expect(b).toEqual([]);
  });
});

describe('pruefeRegeln — Vollständigkeit', () => {
  it('meldet eine Zeile ohne Intervall und ohne "bei Bedarf"', () => {
    const b = pruefeRegeln(lv([zeile('Hartböden feucht wischen', { intervalColumn: '', intervalValue: '' })]), kopf);
    expect(b.some((x) => x.title === 'Kein Intervall festgelegt' && x.type === 'red')).toBe(true);
  });

  it('meldet "bei Bedarf" nicht als fehlendes Intervall', () => {
    const b = pruefeRegeln(
      lv([zeile('Staub & Spinnweben', { bedarf: true, intervalColumn: '', intervalValue: '' })]),
      kopf
    );
    expect(b.some((x) => x.title === 'Kein Intervall festgelegt')).toBe(false);
  });

  it('meldet einen leeren Bereich', () => {
    const b = pruefeRegeln(lv([]), kopf);
    expect(b.some((x) => x.title.includes('ist leer'))).toBe(true);
  });

  it('meldet eine fehlende Beschreibung, wenn der Rest des Bereichs eine hat', () => {
    const b = pruefeRegeln(
      lv([zeile('Hartböden feucht wischen'), zeile('WC reinigen', { beschreibung: '' })]),
      kopf
    );
    expect(b.some((x) => x.title === 'Keine Leistungsbeschreibung' && x.type === 'orange')).toBe(true);
  });

  it('meldet nichts, wenn im ganzen Bereich keine Beschreibung steht', () => {
    const b = pruefeRegeln(
      lv([zeile('Hartböden feucht wischen', { beschreibung: '' }), zeile('WC reinigen', { beschreibung: '' })]),
      kopf
    );
    expect(b.some((x) => x.title === 'Keine Leistungsbeschreibung')).toBe(false);
  });
});

describe('pruefeRegeln — Robustheit', () => {
  it('kommt mit fehlenden Eingaben klar', () => {
    expect(() => pruefeRegeln(null, {})).not.toThrow();
    expect(() => pruefeRegeln(undefined)).not.toThrow();
    expect(() => pruefeRegeln([{ title: 'X' }], kopf)).not.toThrow();
  });

  it('vergibt eindeutige Ids', () => {
    const b = pruefeRegeln(
      lv([zeile('Hartböden feucht wischen'), zeile('Hartböden feucht wischen')]),
      { lvTitle: '', objekt: '' }
    );
    expect(new Set(b.map((x) => x.id)).size).toBe(b.length);
  });
});

describe('alsPruefText', () => {
  it('erzeugt eine kompakte, lesbare Form statt JSON', () => {
    const text = alsPruefText(
      lv([zeile('Hartböden feucht wischen'), zeile('Staub & Spinnweben', { bedarf: true, intervalColumn: '', intervalValue: '', bemerkung: 'Nur EG.' })]),
      kopf
    );
    expect(text).toContain('Titel: Leistungsverzeichnis Unterhaltsreinigung');
    expect(text).toContain('Sanitärbereiche');
    expect(text).toContain('0. Hartböden feucht wischen [2x wöchentlich]');
    expect(text).toContain('1. Staub & Spinnweben [bei Bedarf] | Bemerkung: Nur EG.');
    // Keine technischen Felder, die die KI nichts angehen.
    expect(text).not.toContain('intervalColumn');
    expect(text).not.toContain('wochentage');
  });

  it('ist deutlich kleiner als das JSON', () => {
    const rows = Array.from({ length: 20 }, (_, i) => zeile(`Leistung ${i}`));
    const text = alsPruefText(lv(rows), kopf);
    const json = JSON.stringify(lv(rows), null, 2);
    expect(text.length).toBeLessThan(json.length / 3);
  });
});

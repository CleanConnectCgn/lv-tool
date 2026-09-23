// Feste Prüfregeln für das Leistungsverzeichnis.
//
// Der größte Teil dessen, was beim Checkup gefunden wurde, ist gar keine
// KI-Aufgabe: Duplikate, Tippfehler, widersprüchliche Intervalle, fehlende
// Angaben - das lässt sich eindeutig entscheiden. Diese Regeln laufen
// deshalb direkt im Browser: sofort, kostenlos, bei jeder Änderung, und mit
// immer demselben Ergebnis.
//
// Die KI (siehe /api/ai-check) bekommt danach nur noch das, was sich nicht
// eindeutig entscheiden lässt - und zwar in kompakter Textform statt als
// vollständiges JSON.
//
// Die Befunde haben dasselbe Format wie die KI-Befunde, damit das
// Checkup-Fenster beide gleich behandeln und anwenden kann:
//   { id, type: 'red'|'orange', title, description, targetSection,
//     targetRowIndex, zeilenText, fix, fixType, quelle: 'regel' }
//
// `zeilenText` trägt den Originaltext der betroffenen Zeile. Das Anwenden
// sucht damit die Zeile über ihren Text statt über den Index - sonst greift
// der zweite angewandte Befund daneben, sobald der erste eine Zeile entfernt
// hat.

// Schreibfehler, die in den ausgelieferten LVs tatsächlich vorkamen, plus
// naheliegende Varianten. Links der Fehler, rechts die Korrektur.
export const TIPPFEHLER = {
  Ausstausch: 'Austausch',
  ausstausch: 'austausch',
  Hausringangstür: 'Hauseingangstür',
  Bürorbereiche: 'Bürobereiche',
  Bürorräume: 'Büroräume',
  Gtiffspuren: 'Griffspuren',
  Griffspurren: 'Griffspuren',
  Reinugung: 'Reinigung',
  Reingung: 'Reinigung',
  Reiningung: 'Reinigung',
  Oberflächn: 'Oberflächen',
  Oberlächen: 'Oberflächen',
  Sanitärbeeiche: 'Sanitärbereiche',
  Spinnwebem: 'Spinnweben',
  Spinweben: 'Spinnweben',
  Abfalbehälter: 'Abfallbehälter',
  Abfallbehlter: 'Abfallbehälter',
  Fesnterbänke: 'Fensterbänke',
  Fensterbäne: 'Fensterbänke',
  Treppenhasu: 'Treppenhaus',
  Küchengerte: 'Küchengeräte',
  Waschbekcen: 'Waschbecken',
  Armatruen: 'Armaturen',
  entfenen: 'entfernen',
  entfernern: 'entfernen',
  wischne: 'wischen',
  reiningen: 'reinigen',
  saugem: 'saugen',
};

const INTERVAL_LABEL = {
  woechentlich: 'wöchentlich',
  monatlich: 'monatlich',
  jaehrlich: 'jährlich',
  aufAnfrage: 'auf Anfrage',
  einmalig: 'einmalig',
};

let laufendeNummer = 0;
const neueId = (praefix) => `regel-${praefix}-${++laufendeNummer}`;

// Vergleichsform: Groß/Kleinschreibung, Mehrfach-Leerzeichen und
// Satzzeichen am Ende spielen für "ist das dieselbe Leistung" keine Rolle.
function vergleichsform(text) {
  return (text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]+$/, '')
    .trim();
}

function intervallText(row) {
  if (row.bedarf) return 'bei Bedarf';
  if (!row.intervalColumn || !row.intervalValue) return '';
  return `${row.intervalValue} ${INTERVAL_LABEL[row.intervalColumn] || row.intervalColumn}`;
}

// Findet in einem Text alle bekannten Schreibfehler und gibt die korrigierte
// Fassung zurück. Wortgrenzen, damit "Reinugung" trifft, "Reinigung" nicht.
function korrigiereTippfehler(text) {
  let korrigiert = text || '';
  const gefunden = [];
  Object.entries(TIPPFEHLER).forEach(([falsch, richtig]) => {
    const regex = new RegExp(`\\b${falsch}\\b`, 'g');
    if (regex.test(korrigiert)) {
      gefunden.push(falsch);
      korrigiert = korrigiert.replace(regex, richtig);
    }
  });
  return { korrigiert, gefunden };
}

/**
 * Prüft ein Leistungsverzeichnis gegen die festen Regeln.
 * @param {Array} sections  Bereiche des LV
 * @param {Object} kopf     { lvTitle, objekt }
 * @returns {Array} Befunde im Issue-Format
 */
export function pruefeRegeln(sections, { lvTitle = '', objekt = '' } = {}) {
  const befunde = [];
  laufendeNummer = 0;
  const bereiche = Array.isArray(sections) ? sections : [];

  // --- Kopfdaten -----------------------------------------------------
  const titel = (lvTitle || '').trim();
  if (!titel) {
    befunde.push({
      id: neueId('titel'),
      type: 'red',
      title: 'Kein Titel',
      description:
        'Das Leistungsverzeichnis hat keinen Titel. Im PDF steht dann nur "Leistungsverzeichnis" ohne Leistungsart, und der Dateiname wird unbrauchbar.',
      targetSection: null,
      targetRowIndex: null,
      fix: null,
      fixType: 'info',
      quelle: 'regel',
    });
  } else if (/^leistungsverzeichnis$/i.test(titel)) {
    befunde.push({
      id: neueId('titel'),
      type: 'red',
      title: 'Titel nennt die Leistungsart nicht',
      description:
        'Der Titel lautet nur "Leistungsverzeichnis". Er sollte die Leistungsart nennen, zum Beispiel "Leistungsverzeichnis Unterhaltsreinigung" oder "Leistungsverzeichnis Glasreinigung".',
      targetSection: null,
      targetRowIndex: null,
      fix: null,
      fixType: 'info',
      quelle: 'regel',
    });
  }

  if (!(objekt || '').trim()) {
    befunde.push({
      id: neueId('objekt'),
      type: 'red',
      title: 'Kein Objekt angegeben',
      description: 'Ohne Objekt lässt sich das Dokument später nicht zuordnen und der Dateiname wird unbrauchbar.',
      targetSection: null,
      targetRowIndex: null,
      fix: null,
      fixType: 'info',
      quelle: 'regel',
    });
  }

  // --- Je Bereich ----------------------------------------------------
  bereiche.forEach((bereich) => {
    const titelBereich = bereich.title || '';
    const zeilen = (bereich.rows || []).filter((r) => (r.text || '').trim());

    if (zeilen.length === 0) {
      befunde.push({
        id: neueId('leer'),
        type: 'orange',
        title: `Bereich "${titelBereich}" ist leer`,
        description: 'Der Bereich enthält keine Leistung und erscheint deshalb nicht im PDF.',
        targetSection: titelBereich,
        targetRowIndex: null,
        fix: null,
        fixType: 'info',
        quelle: 'regel',
      });
      return;
    }

    const mitBeschreibung = zeilen.filter((r) => (r.beschreibung || '').trim()).length;
    const gesehen = new Map(); // Vergleichsform -> { index, row }

    (bereich.rows || []).forEach((row, index) => {
      const text = (row.text || '').trim();
      if (!text) return;

      // Tippfehler in allen drei Textfeldern
      const felder = [
        ['text', row.text, 'Leistungsbezeichnung'],
        ['beschreibung', row.beschreibung, 'Leistungsbeschreibung'],
        ['bemerkung', row.bemerkung, 'Bemerkung'],
      ];
      felder.forEach(([feld, wert, bezeichnung]) => {
        if (!(wert || '').trim()) return;
        const { korrigiert, gefunden } = korrigiereTippfehler(wert);
        if (gefunden.length === 0) return;
        befunde.push({
          id: neueId('tippfehler'),
          type: 'red',
          title: `Schreibfehler: ${gefunden.join(', ')}`,
          description: `In der ${bezeichnung} von "${text}" steht "${gefunden.join('", "')}".`,
          targetSection: titelBereich,
          targetRowIndex: index,
          zeilenText: text,
          fix: korrigiert,
          fixType: feld === 'text' ? 'replace_row' : `replace_${feld}`,
          quelle: 'regel',
        });
      });

      // Desinfektionsformulierung
      if (/desinfizier/i.test(`${row.text} ${row.beschreibung || ''} ${row.bemerkung || ''}`)) {
        befunde.push({
          id: neueId('desinfektion'),
          type: 'red',
          title: 'Desinfektion zugesichert',
          description: `"${text}" sichert eine Desinfektion zu. Das ist eine Wirkung mit Einwirkzeit, die in der Unterhaltsreinigung nicht geschuldet werden soll.`,
          targetSection: titelBereich,
          targetRowIndex: index,
          zeilenText: text,
          fix: row.text.replace(/desinfizierend\s+/gi, 'feucht ').replace(/\s*(und|&)\s*desinfizieren/gi, ''),
          fixType: 'replace_row',
          quelle: 'regel',
        });
      }

      // Weder Intervall noch "bei Bedarf": vertraglich unklar
      if (!row.bedarf && (!row.intervalColumn || !row.intervalValue)) {
        befunde.push({
          id: neueId('ohne-intervall'),
          type: 'red',
          title: 'Kein Intervall festgelegt',
          description: `Bei "${text}" ist weder ein Intervall noch "bei Bedarf" gesetzt. Damit steht nicht fest, was geschuldet ist.`,
          targetSection: titelBereich,
          targetRowIndex: index,
          zeilenText: text,
          fix: null,
          fixType: 'info',
          quelle: 'regel',
        });
      }

      // Duplikat oder Intervall-Widerspruch innerhalb desselben Bereichs
      const schluessel = vergleichsform(text);
      if (gesehen.has(schluessel)) {
        const vorher = gesehen.get(schluessel);
        const intervallA = intervallText(vorher.row);
        const intervallB = intervallText(row);
        if (intervallA === intervallB) {
          befunde.push({
            id: neueId('duplikat'),
            type: 'red',
            title: 'Doppelte Leistung',
            description: `"${text}" steht in "${titelBereich}" zweimal mit demselben Intervall.`,
            targetSection: titelBereich,
            targetRowIndex: index,
            zeilenText: text,
            fix: null,
            fixType: 'remove_row',
            quelle: 'regel',
          });
        } else {
          befunde.push({
            id: neueId('widerspruch'),
            type: 'red',
            title: 'Widersprüchliche Intervalle',
            description: `"${text}" steht in "${titelBereich}" zweimal, einmal mit "${intervallA || 'ohne Intervall'}" und einmal mit "${intervallB || 'ohne Intervall'}".`,
            targetSection: titelBereich,
            targetRowIndex: index,
            zeilenText: text,
            fix: null,
            fixType: 'info',
            quelle: 'regel',
          });
        }
      } else {
        gesehen.set(schluessel, { index, row });
      }

      // Fehlende Leistungsbeschreibung, wo der Rest des Bereichs eine hat
      if (!(row.beschreibung || '').trim() && mitBeschreibung > 0 && mitBeschreibung >= zeilen.length - 1) {
        befunde.push({
          id: neueId('ohne-beschreibung'),
          type: 'orange',
          title: 'Keine Leistungsbeschreibung',
          description: `"${text}" hat keine ausformulierte Leistungsbeschreibung, die übrigen Zeilen in "${titelBereich}" schon.`,
          targetSection: titelBereich,
          targetRowIndex: index,
          zeilenText: text,
          fix: null,
          fixType: 'info',
          quelle: 'regel',
        });
      }
    });
  });

  return befunde;
}

/**
 * Kompakte Textform des LV für die KI-Prüfung.
 *
 * Statt des vollständigen JSON (mit IDs, Wochentags-Arrays und leeren
 * Feldern) geht nur das raus, was fachlich zählt. Das ist rund sieben Mal
 * kleiner und damit entsprechend günstiger und schneller.
 */
export function alsPruefText(sections, { lvTitle = '', objekt = '' } = {}) {
  const kopf = [`Titel: ${lvTitle || '(leer)'}`, `Objekt: ${objekt || '(leer)'}`].join('\n');
  const koerper = (sections || [])
    .map((bereich) => {
      const zeilen = (bereich.rows || [])
        .filter((r) => (r.text || '').trim())
        .map((row, index) => {
          const teile = [`  ${index}. ${row.text.trim()}`];
          const iv = intervallText(row);
          teile.push(iv ? `[${iv}]` : '[ohne Intervall]');
          if ((row.bemerkung || '').trim()) teile.push(`| Bemerkung: ${row.bemerkung.trim()}`);
          return teile.join(' ');
        });
      return `${bereich.title || '(ohne Titel)'}\n${zeilen.join('\n')}`;
    })
    .join('\n\n');
  return `${kopf}\n\n${koerper}`;
}

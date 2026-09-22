// Wendet die vom Assistenten vorgeschlagenen Änderungen auf das LV an.
//
// Bewusst als reine Funktionen ohne React: so lässt sich jede Aktion einzeln
// prüfen, und die UI muss nur noch anzeigen und bestätigen lassen. Angewendet
// wird immer erst nach ausdrücklicher Bestätigung im Assistenten-Fenster.

import { AREA_DEFINITIONS } from '../templates/checklistAreas.js';
import { getDescriptionFor } from '../templates/suggestions.js';

let idCounter = 900000;
const uid = () => `a${idCounter++}-${Math.random().toString(36).slice(2, 8)}`;

const norm = (s) => (s || '').trim().toLowerCase();

function findSectionIndex(sections, bereich) {
  return sections.findIndex((s) => norm(s.title) === norm(bereich));
}

// Kurze, verständliche Beschreibung einer Aktion für die Bestätigungsliste.
export function describeAktion(aktion) {
  switch (aktion?.typ) {
    case 'intervall_aendern': {
      const ziel = aktion.zeile ? `"${aktion.zeile}"` : `alle Zeilen in "${aktion.bereich}"`;
      if (aktion.bedarf) return `${ziel} auf "Bei Bedarf" setzen`;
      const spalte =
        { woechentlich: 'wöchentlich', monatlich: 'monatlich', jaehrlich: 'jährlich' }[
          aktion.intervalColumn
        ] || aktion.intervalColumn;
      return `${ziel} auf ${aktion.intervalValue} ${spalte} setzen`;
    }
    case 'zeile_entfernen':
      return `"${aktion.zeile}" aus "${aktion.bereich}" entfernen`;
    case 'zeile_hinzufuegen':
      return `"${aktion.katalogText}" zu "${aktion.bereich}" hinzufügen`;
    case 'bereich_hinzufuegen':
      return `Bereich "${AREA_DEFINITIONS[aktion.areaKey]?.label || aktion.areaKey}" hinzufügen`;
    case 'bereich_entfernen':
      return `Bereich "${aktion.bereich}" entfernen`;
    case 'bemerkung_setzen':
      return `Bemerkung bei "${aktion.zeile}" setzen: "${aktion.text}"`;
    case 'titel_setzen':
      return `Titel auf "${aktion.titel}" setzen`;
    default:
      return 'Unbekannte Änderung';
  }
}

// Wendet eine einzelne Aktion an und gibt die neuen Bereiche zurück.
// `meta` nimmt Änderungen auf, die nicht in den Bereichen liegen (Titel).
export function applyAktion(sections, aktion, meta = {}) {
  const next = sections.map((s) => ({ ...s, rows: [...(s.rows || [])] }));

  switch (aktion?.typ) {
    case 'titel_setzen':
      meta.lvTitle = aktion.titel;
      return next;

    case 'bereich_hinzufuegen': {
      const def = AREA_DEFINITIONS[aktion.areaKey];
      if (!def) return next;
      const built = def.build();
      // Frequenz aus dem LV übernehmen, statt eine eigene zu erfinden:
      // die häufigste wöchentliche Angabe der bestehenden Bereiche.
      const freq = haeufigsteWochenfrequenz(sections);
      built.rows = built.rows.map((r) =>
        r.intervalColumn === 'woechentlich' && !r.intervalValue ? { ...r, intervalValue: freq } : r
      );
      return [...next, built];
    }

    case 'bereich_entfernen': {
      const i = findSectionIndex(next, aktion.bereich);
      if (i < 0) return next;
      next.splice(i, 1);
      return next;
    }

    case 'zeile_hinzufuegen': {
      const i = findSectionIndex(next, aktion.bereich);
      if (i < 0) return next;
      next[i].rows = [
        ...next[i].rows,
        {
          id: uid(),
          text: aktion.katalogText,
          bedarf: false,
          intervalColumn: 'woechentlich',
          intervalValue: haeufigsteWochenfrequenz(sections),
          bemerkung: '',
          beschreibung: getDescriptionFor(aktion.katalogText),
          wochentage: [],
        },
      ];
      return next;
    }

    case 'zeile_entfernen': {
      const i = findSectionIndex(next, aktion.bereich);
      if (i < 0) return next;
      next[i].rows = next[i].rows.filter((r) => norm(r.text) !== norm(aktion.zeile));
      return next;
    }

    case 'bemerkung_setzen': {
      const i = findSectionIndex(next, aktion.bereich);
      if (i < 0) return next;
      next[i].rows = next[i].rows.map((r) =>
        norm(r.text) === norm(aktion.zeile) ? { ...r, bemerkung: aktion.text } : r
      );
      return next;
    }

    case 'intervall_aendern': {
      const i = findSectionIndex(next, aktion.bereich);
      if (i < 0) return next;
      const patch = aktion.bedarf
        ? { bedarf: true, intervalColumn: '', intervalValue: '' }
        : {
            bedarf: false,
            intervalColumn: aktion.intervalColumn,
            intervalValue: aktion.intervalValue,
          };
      next[i].rows = next[i].rows.map((r) => {
        if (aktion.zeile && norm(r.text) !== norm(aktion.zeile)) return r;
        // Ohne Zeilenangabe nur die Zeilen anfassen, die überhaupt ein
        // wöchentliches Intervall haben - "Bei Bedarf"-Zeilen bleiben, wie
        // sie sind, sonst würde z.B. "Spinnweben entfernen" plötzlich
        // wöchentlich geschuldet.
        if (!aktion.zeile && r.intervalColumn !== 'woechentlich') return r;
        return { ...r, ...patch };
      });
      return next;
    }

    default:
      return next;
  }
}

// Häufigste wöchentliche Frequenz im LV, als Vorgabe für neue Zeilen.
export function haeufigsteWochenfrequenz(sections, fallback = '2x') {
  const zaehler = new Map();
  (sections || []).forEach((s) =>
    (s.rows || []).forEach((r) => {
      if (r.intervalColumn === 'woechentlich' && r.intervalValue) {
        zaehler.set(r.intervalValue, (zaehler.get(r.intervalValue) || 0) + 1);
      }
    })
  );
  if (zaehler.size === 0) return fallback;
  return [...zaehler.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

// Wendet mehrere Aktionen nacheinander an.
export function applyAktionen(sections, aktionen, meta = {}) {
  return (aktionen || []).reduce((acc, a) => applyAktion(acc, a, meta), sections);
}

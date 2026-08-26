// Reine, docx-freie String-Formatierung für die PDF-Renderer (Vertrag + AVV +
// LV). Vorher Teil von docxHelpers.js - seit dem Wegfall der DOCX-Ausgabe
// (nur noch PDF) hierher verschoben, damit die PDF-Renderer nicht mehr von
// einem Modul abhängen, das die 'docx'-Bibliothek importiert.

export function formatEuro(value) {
  // Bug gefunden beim Rechts-Audit 2026-07-30: Number(null) und Number('')
  // sind 0, nicht NaN - eine fehlende Vergütung wurde dadurch fälschlich
  // als "0,00 EUR" ins Dokument geschrieben (ein erfundener, falscher
  // Geldbetrag) statt als erkennbarer Platzhalter. Echte 0 (z.B. bewusst
  // kostenlose Zusatzleistung) bleibt "0,00 EUR" - nur fehlende Werte
  // werden jetzt als "—" erkannt.
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  return `${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
}

// MwSt.-Satz wurde vorher als rohe JS-Zahl interpoliert (`${satz} %`) - bei
// einem Nicht-Ganzzahl-Satz (z.B. 7,5 %) wäre das als "7.5 %" mit
// englischem Punkt statt deutschem Komma im Dokument gelandet. Gefunden
// beim Rechts-Audit 2026-07-30.
export function formatPercent(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

export function formatDateDE(iso) {
  if (!iso) return '[Datum]';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

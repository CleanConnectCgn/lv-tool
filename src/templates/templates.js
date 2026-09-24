// Interval columns used across the app
export const INTERVAL_COLUMNS = ['woechentlich', 'monatlich', 'jaehrlich'];
export const INTERVAL_VALUES = ['1x', '2x', '3x', '4x', '5x', '6x', '7x'];

let idCounter = 1;
const uid = () => `r${idCounter++}-${Math.random().toString(36).slice(2, 8)}`;

// A row has exactly one of: bedarf=true, or {intervalColumn, intervalValue} set.
function row(text, opts = {}) {
  return {
    id: uid(),
    text,
    bedarf: !!opts.bedarf,
    intervalColumn: opts.bedarf ? '' : opts.column || '',
    intervalValue: opts.bedarf ? '' : opts.value || '',
    bemerkung: opts.bemerkung || '',
    // Ausformulierte, vertragsfeste Leistungsbeschreibung aus dem Katalog
    // (z.B. "Feuchte Reinigung der Hartbodenflächen ... einschließlich
    // Entfernung von Schmutz, Staub und sonstigen oberflächlichen
    // Verunreinigungen."). Steht neben `text` (Kurzbezeichnung) und wird im
    // PDF in der Spalte "Leistungsbeschreibung" ausgegeben. `bemerkung`
    // bleibt davon getrennt und trägt weiterhin die objektspezifische Notiz.
    beschreibung: opts.beschreibung || '',
    // Optionale Wochentags-Auswahl (z.B. ["Mo","Mi","Fr"]) zusätzlich zur
    // Intervall-Spalte, siehe WeekdaySelector.jsx.
    wochentage: opts.wochentage || [],
  };
}

function section(title, rows) {
  return { id: uid(), title, rows };
}

// Fasst das Reinigungsintervall des gesamten Objekts als EIN Label zusammen
// (z.B. "2x wöchentlich"), statt es leer zu lassen und beim sevDesk-Angebot
// auf den generischen Fallback "laut Leistungsverzeichnis" zurückzufallen
// (src/lib/sevdesk.js). Nimmt je Intervall-Spalte (wöchentlich > monatlich >
// jährlich, absteigend nach Häufigkeit) das MAXIMUM über alle aktiven
// (nicht Bedarf, nicht leer) Zeilen - ein Objekt, das überwiegend 2x
// wöchentlich, aber für einzelne Leistungen nur 1x wöchentlich gereinigt
// wird, soll als "2x wöchentlich" beworben werden, nicht als "1x".
export function computeIntervalSummary(sections) {
  const rows = (sections || []).flatMap((s) => s.rows || []);
  const activeRows = rows.filter((r) => (r.text || '').trim() && !r.bedarf);

  const columnLabel = { woechentlich: 'wöchentlich', monatlich: 'monatlich', jaehrlich: 'jährlich' };
  for (const col of INTERVAL_COLUMNS) {
    const values = activeRows
      .filter((r) => r.intervalColumn === col && r.intervalValue)
      .map((r) => parseInt(r.intervalValue, 10))
      .filter((n) => !Number.isNaN(n));
    if (values.length > 0) {
      return `${Math.max(...values)}x ${columnLabel[col]}`;
    }
  }
  return '';
}

const COLUMN_LABELS = { woechentlich: 'Wöchentlich', monatlich: 'Monatlich', jaehrlich: 'Jährlich' };

// Baut die Optionsliste für eine kombinierte Intervall-Auswahl (Spalte+Wert
// als ein Wert-String, z.B. "woechentlich:2x"). Wird sowohl vom
// Zeileneditor als auch vom Bulk-Edit (mehrere Zeilen auf einmal) genutzt,
// damit beide immer dieselben Optionen anbieten.
export function buildIntervalSelectOptions({ includeBedarf = false } = {}) {
  const opts = [{ value: '', label: 'kein Intervall' }];
  if (includeBedarf) opts.push({ value: 'bedarf', label: 'Bei Bedarf' });
  INTERVAL_COLUMNS.forEach((col) => {
    INTERVAL_VALUES.forEach((val) => {
      opts.push({ value: `${col}:${val}`, label: `${COLUMN_LABELS[col]} ${val}` });
    });
  });
  opts.push({ value: 'aufAnfrage:Ja', label: 'Auf Anfrage' });
  opts.push({ value: 'einmalig:Ja', label: 'Einmalig' });
  return opts;
}

// Wandelt den Wert einer solchen Auswahl in ein Zeilen-Patch um - die
// Gegenrichtung zu buildIntervalSelectOptions().
export function intervalPatchFromSelectValue(value) {
  if (!value) return { bedarf: false, intervalColumn: '', intervalValue: '' };
  if (value === 'bedarf') return { bedarf: true, intervalColumn: '', intervalValue: '' };
  const [col, val] = value.split(':');
  return { bedarf: false, intervalColumn: col, intervalValue: val };
}

// ---- Winterdienst ----
// Einziges hier noch aktiv genutztes Branchen-Template (via cloneTemplate('winterdienst')
// in checklistAreas.js). Die früheren Templates für Büro/Arztpraxis/Treppenhaus/
// Gewerbehalle/Glasreinigung wurden entfernt, da sie seit der Umstellung auf das
// Bereichs-Checkbox-System (siehe checklistAreas.js) nirgends mehr referenziert wurden.
const winterdienst = [
  section('Räum- und Streupflicht', [
    row('Gehwege von Schnee räumen', { bedarf: true }),
    row('Gehwege bei Glätte abstreuen', { bedarf: true }),
    row('Zufahrten & Parkplätze räumen', { bedarf: true }),
    row('Treppen & Eingangsbereiche räumen und streuen', { bedarf: true }),
  ]),
  section('Nacharbeiten', [
    row('Streugut nach Tauwetter entfernen/kehren', { bedarf: true }),
    row('Kontrolle und Nachstreuen im Tagesverlauf', { bedarf: true }),
  ]),
];

// ---- Optional Services (as add-on sections) ----
export const optionalServices = {
  glasreinigung: section('Glasreinigung (optional)', [
    row('Glasflächen innen und außen reinigen', { column: 'jaehrlich', value: '2x' }),
    row('Fensterrahmen & Fensterbänke feucht wischen', { column: 'jaehrlich', value: '2x' }),
  ]),
  lamellenreinigung: section('Lamellenreinigung (optional)', [
    row('Lamellenreinigung (Jalousien/Sonnenschutz)', { column: 'jaehrlich', value: '1x' }),
  ]),
  grundreinigung: section('Grundreinigung (optional)', [
    row('Grundreinigung Böden', { column: 'jaehrlich', value: '1x' }),
    row('Grundreinigung Sanitärbereiche', { column: 'jaehrlich', value: '1x' }),
  ]),
};

export const templates = {
  winterdienst: { label: 'Winterdienst', sections: winterdienst },
};

export function cloneTemplate(key) {
  const tpl = templates[key];
  if (!tpl) return [];
  return tpl.sections.map((s) => ({
    id: uid(),
    title: s.title,
    rows: s.rows.map((r) => ({ ...r, id: uid() })),
  }));
}

export function cloneOptionalSection(key) {
  const s = optionalServices[key];
  if (!s) return null;
  return {
    id: uid(),
    title: s.title,
    rows: s.rows.map((r) => ({ ...r, id: uid() })),
  };
}

export function newEmptyRow() {
  return row('');
}

export function newSection(title = 'Neuer Bereich') {
  return section(title, [newEmptyRow()]);
}

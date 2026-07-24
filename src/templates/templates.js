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
    // Optionale Wochentags-Auswahl (z.B. ["Mo","Mi","Fr"]) zusätzlich zur
    // Intervall-Spalte, siehe WeekdaySelector.jsx.
    wochentage: opts.wochentage || [],
  };
}

function section(title, rows) {
  return { id: uid(), title, rows };
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

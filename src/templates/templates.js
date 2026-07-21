// Interval columns used across the app
export const INTERVAL_COLUMNS = ['woechentlich', 'monatlich', 'jaehrlich'];
export const INTERVAL_VALUES = ['1x', '2x', '3x', 'Tägl.'];

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
  };
}

function section(title, rows) {
  return { id: uid(), title, rows, price: '' };
}

// ---- Büro ----
const buero = [
  section('Flur- und Verkehrsbereich', [
    row('Hartböden feucht wischen & Textilbeläge saugen', { column: 'woechentlich', value: '2x' }),
    row('Abfalleimer entleeren inkl. Austausch der Beutel', { column: 'woechentlich', value: '2x' }),
    row('Türklinken & Lichtschalter desinfizieren', { column: 'woechentlich', value: '2x' }),
    row('Staub & Spinnweben entfernen an Decken und in Ecken', { column: 'woechentlich', value: '2x' }),
  ]),
  section('Bürobereiche', [
    row('Schreibtische feucht abwischen (freie Flächen)', { column: 'woechentlich', value: '2x' }),
    row('Böden saugen und feucht wischen', { column: 'woechentlich', value: '2x' }),
    row('Abfalleimer entleeren inkl. Austausch der Beutel', { column: 'woechentlich', value: '2x' }),
    row('Bildschirme & Tastaturen entstauben', { column: 'monatlich', value: '1x' }),
    row('Fensterbänke feucht wischen', { column: 'monatlich', value: '1x' }),
  ]),
  section('Küche', [
    row('Arbeitsflächen reinigen und desinfizieren', { column: 'woechentlich', value: '2x' }),
    row('Spüle reinigen und desinfizieren', { column: 'woechentlich', value: '2x' }),
    row('Böden feucht wischen', { column: 'woechentlich', value: '2x' }),
    row('Kühlschrank außen abwischen', { column: 'monatlich', value: '1x' }),
    row('Mikrowelle innen & außen reinigen', { column: 'monatlich', value: '1x' }),
  ]),
  section('Sanitärbereich', [
    row('WC-Oberflächen, WC-Sitze & Spülungen säubern', { column: 'woechentlich', value: '2x' }),
    row('Waschbecken, Armaturen & Wandspiegel reinigen', { column: 'woechentlich', value: '2x' }),
    row('Böden feucht wischen und desinfizieren', { column: 'woechentlich', value: '2x' }),
    row('Seifen- & Handtuchspender auffüllen', { column: 'woechentlich', value: '2x' }),
    row('Abfalleimer entleeren inkl. Austausch der Beutel', { column: 'woechentlich', value: '2x' }),
  ]),
];

// ---- Arztpraxis (nach Vorbild Alte Heerstraße 53) ----
const arztpraxis = [
  section('Flur- und Verkehrsbereich', [
    row('Hartböden feucht wischen', { column: 'monatlich', value: '2x' }),
    row('Abfalleimer entleeren inkl. Austausch der Beutel', { column: 'monatlich', value: '2x' }),
    row('Türklinken desinfizieren', { column: 'monatlich', value: '2x' }),
    row('Staub & Spinnweben entfernen', { column: 'monatlich', value: '2x' }),
  ]),
  section('Behandlungsräume', [
    row('Liegen & Behandlungsflächen desinfizieren', { column: 'monatlich', value: '2x' }),
    row('Böden feucht wischen und desinfizieren', { column: 'monatlich', value: '2x' }),
    row('Abfalleimer entleeren (Sonderabfall gesondert)', { column: 'monatlich', value: '2x' }),
    row('Türklinken & Lichtschalter desinfizieren', { column: 'monatlich', value: '2x' }),
    row('Waschbecken, Armaturen & Wandspiegel reinigen', { column: 'monatlich', value: '2x' }),
  ]),
  section('Empfang & Wartebereich', [
    row('Böden feucht wischen', { column: 'monatlich', value: '2x' }),
    row('Sitzflächen abwischen', { column: 'monatlich', value: '2x' }),
    row('Tresen & Ablageflächen reinigen', { column: 'monatlich', value: '2x' }),
    row('Abfalleimer entleeren inkl. Austausch der Beutel', { column: 'monatlich', value: '2x' }),
  ]),
  section('Sanitärbereich', [
    row('WC-Oberflächen, WC-Sitze & Spülungen säubern', { column: 'monatlich', value: '2x' }),
    row('Waschbecken, Armaturen & Wandspiegel reinigen', { column: 'monatlich', value: '2x' }),
    row('Böden feucht wischen und desinfizieren', { column: 'monatlich', value: '2x' }),
    row('Desinfektionsmittelspender auffüllen', { column: 'monatlich', value: '2x' }),
    row('Abfalleimer entleeren inkl. Austausch der Beutel', { column: 'monatlich', value: '2x' }),
  ]),
];

// ---- Treppenhaus ----
const treppenhaus = [
  section('Treppenhaus', [
    row('Treppenstufen kehren und feucht wischen', { column: 'woechentlich', value: '1x' }),
    row('Handläufe abwischen', { column: 'woechentlich', value: '1x' }),
    row('Fensterbänke entstauben', { column: 'monatlich', value: '1x' }),
    row('Staub & Spinnweben entfernen', { column: 'monatlich', value: '1x' }),
    row('Hauseingang & Fußmatte reinigen', { column: 'woechentlich', value: '1x' }),
    row('Briefkastenanlage abwischen', { column: 'monatlich', value: '1x' }),
  ]),
  section('Keller & Gemeinschaftsflächen', [
    row('Kellerflur kehren', { column: 'monatlich', value: '1x' }),
    row('Waschküche reinigen', { column: 'monatlich', value: '1x' }),
  ]),
];

// ---- Gewerbehalle ----
const gewerbehalle = [
  section('Hallenboden', [
    row('Kehren & maschinelle Bodenreinigung großflächig', { column: 'woechentlich', value: '1x' }),
    row('Verkehrswege feucht wischen', { column: 'woechentlich', value: '1x' }),
    row('Grobschmutz & Fremdkörper entfernen', { column: 'woechentlich', value: '1x' }),
  ]),
  section('Sozialräume', [
    row('Umkleiden reinigen', { column: 'woechentlich', value: '2x' }),
    row('Sanitäranlagen reinigen und desinfizieren', { column: 'woechentlich', value: '2x' }),
    row('Pausenraum reinigen', { column: 'woechentlich', value: '2x' }),
    row('Abfalleimer entleeren inkl. Austausch der Beutel', { column: 'woechentlich', value: '2x' }),
  ]),
  section('Büro- & Verwaltungsbereich', [
    row('Böden feucht wischen', { column: 'woechentlich', value: '1x' }),
    row('Schreibtische feucht abwischen', { column: 'woechentlich', value: '1x' }),
    row('Abfalleimer entleeren inkl. Austausch der Beutel', { column: 'woechentlich', value: '1x' }),
  ]),
];

// ---- Glasreinigung ----
const glasreinigung = [
  section('Glasflächen', [
    row('Glasflächen innen und außen reinigen', { column: 'jaehrlich', value: '2x' }),
    row('Fensterrahmen & Fensterbänke feucht wischen', { column: 'jaehrlich', value: '2x' }),
    row('Türverglasung reinigen', { column: 'jaehrlich', value: '2x' }),
  ]),
  section('Lamellen', [
    row('Lamellenreinigung (Jalousien/Sonnenschutz)', { column: 'jaehrlich', value: '1x' }),
  ]),
];

// ---- Winterdienst ----
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
  buero: { label: 'Büro', sections: buero },
  arztpraxis: { label: 'Arztpraxis', sections: arztpraxis },
  treppenhaus: { label: 'Treppenhaus', sections: treppenhaus },
  gewerbehalle: { label: 'Gewerbehalle', sections: gewerbehalle },
  glasreinigung: { label: 'Glasreinigung', sections: glasreinigung },
  winterdienst: { label: 'Winterdienst', sections: winterdienst },
};

export function cloneTemplate(key) {
  const tpl = templates[key];
  if (!tpl) return [];
  return tpl.sections.map((s) => ({
    id: uid(),
    title: s.title,
    rows: s.rows.map((r) => ({ ...r, id: uid() })),
    price: '',
  }));
}

export function cloneOptionalSection(key) {
  const s = optionalServices[key];
  if (!s) return null;
  return {
    id: uid(),
    title: s.title,
    rows: s.rows.map((r) => ({ ...r, id: uid() })),
    price: '',
  };
}

export function newEmptyRow() {
  return row('');
}

export function newSection(title = 'Neuer Bereich') {
  return section(title, [newEmptyRow()]);
}

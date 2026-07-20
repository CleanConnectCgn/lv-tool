// Interval keys used across the app
export const INTERVALS = ['bedarf', 'woechentlich', 'monatlich', 'jaehrlich'];

let idCounter = 1;
const uid = () => `r${idCounter++}-${Math.random().toString(36).slice(2, 8)}`;

function row(text, opts = {}) {
  return {
    id: uid(),
    text,
    bedarf: !!opts.bedarf,
    woechentlich: opts.woechentlich || '',
    monatlich: opts.monatlich || '',
    jaehrlich: opts.jaehrlich || '',
    bemerkung: opts.bemerkung || '',
  };
}

function section(title, rows) {
  return { id: uid(), title, rows };
}

// ---- Büro ----
const buero = [
  section('Flur', [
    row('Böden reinigen', { woechentlich: '2x' }),
    row('Abfallbehälter leeren', { woechentlich: '2x' }),
    row('Türklinken/Lichtschalter desinfizieren', { woechentlich: '2x' }),
    row('Spinnweben entfernen', { woechentlich: '2x' }),
  ]),
  section('Bürobereiche', [
    row('Schreibtische feucht abwischen (freie Flächen)', { woechentlich: '2x' }),
    row('Böden saugen/wischen', { woechentlich: '2x' }),
    row('Abfallbehälter leeren', { woechentlich: '2x' }),
    row('Bildschirme/Tastaturen abstauben', { monatlich: '1x' }),
    row('Fensterbänke abwischen', { monatlich: '1x' }),
  ]),
  section('Küche', [
    row('Arbeitsflächen reinigen und desinfizieren', { woechentlich: '2x' }),
    row('Spüle reinigen', { woechentlich: '2x' }),
    row('Böden reinigen', { woechentlich: '2x' }),
    row('Kühlschrank außen abwischen', { monatlich: '1x' }),
    row('Mikrowelle innen/außen reinigen', { monatlich: '1x' }),
  ]),
  section('Sanitär', [
    row('WC und Waschbecken reinigen und desinfizieren', { woechentlich: '2x' }),
    row('Spiegel reinigen', { woechentlich: '2x' }),
    row('Böden reinigen und desinfizieren', { woechentlich: '2x' }),
    row('Seifenspender/Handtuchspender auffüllen', { woechentlich: '2x' }),
    row('Abfallbehälter leeren', { woechentlich: '2x' }),
  ]),
];

// ---- Arztpraxis (nach Vorbild Alte Heerstraße 53) ----
const arztpraxis = [
  section('Flur', [
    row('Böden wischen', { monatlich: '2x' }),
    row('Abfallbehälter leeren', { monatlich: '2x' }),
    row('Türklinken desinfizieren', { monatlich: '2x' }),
    row('Spinnweben entfernen', { monatlich: '2x' }),
  ]),
  section('Behandlungsräume', [
    row('Liegen/Behandlungsflächen desinfizieren', { monatlich: '2x' }),
    row('Böden wischen und desinfizieren', { monatlich: '2x' }),
    row('Abfallbehälter leeren (inkl. Sonderabfall gesondert)', { monatlich: '2x' }),
    row('Türklinken/Lichtschalter desinfizieren', { monatlich: '2x' }),
    row('Waschbecken reinigen und desinfizieren', { monatlich: '2x' }),
  ]),
  section('Empfang/Wartebereich', [
    row('Böden reinigen', { monatlich: '2x' }),
    row('Sitzflächen abwischen', { monatlich: '2x' }),
    row('Tresen/Ablageflächen reinigen', { monatlich: '2x' }),
    row('Abfallbehälter leeren', { monatlich: '2x' }),
  ]),
  section('Sanitär', [
    row('WC und Waschbecken reinigen und desinfizieren', { monatlich: '2x' }),
    row('Spiegel reinigen', { monatlich: '2x' }),
    row('Böden reinigen und desinfizieren', { monatlich: '2x' }),
    row('Seifen-/Desinfektionsmittelspender auffüllen', { monatlich: '2x' }),
    row('Abfallbehälter leeren', { monatlich: '2x' }),
  ]),
];

// ---- Treppenhaus ----
const treppenhaus = [
  section('Treppenhaus', [
    row('Treppenstufen kehren und wischen', { woechentlich: '1x' }),
    row('Handläufe abwischen', { woechentlich: '1x' }),
    row('Fensterbänke abstauben', { monatlich: '1x' }),
    row('Spinnweben entfernen', { monatlich: '1x' }),
    row('Hauseingang/Fußmatte reinigen', { woechentlich: '1x' }),
    row('Briefkastenanlage abwischen', { monatlich: '1x' }),
  ]),
  section('Keller/Gemeinschaftsflächen', [
    row('Kellerflur kehren', { monatlich: '1x' }),
    row('Waschküche reinigen', { monatlich: '1x' }, ),
  ]),
];

// ---- Gewerbehalle ----
const gewerbehalle = [
  section('Hallenboden', [
    row('Kehren/Maschinenreinigung großflächig', { woechentlich: '1x' }),
    row('Wischen der Verkehrswege', { woechentlich: '1x' }),
    row('Grobschmutz/Fremdkörper entfernen', { woechentlich: '1x' }),
  ]),
  section('Sozialräume', [
    row('Umkleiden reinigen', { woechentlich: '2x' }),
    row('Sanitäranlagen reinigen und desinfizieren', { woechentlich: '2x' }),
    row('Pausenraum reinigen', { woechentlich: '2x' }),
    row('Abfallbehälter leeren', { woechentlich: '2x' }),
  ]),
  section('Büro-/Verwaltungsbereich', [
    row('Böden reinigen', { woechentlich: '1x' }),
    row('Schreibtische abwischen', { woechentlich: '1x' }),
    row('Abfallbehälter leeren', { woechentlich: '1x' }),
  ]),
];

// ---- Glasreinigung ----
const glasreinigung = [
  section('Glasflächen', [
    row('Fenster innen und außen reinigen', { jaehrlich: '2x' }),
    row('Rahmen und Fensterbänke reinigen', { jaehrlich: '2x' }),
    row('Türverglasung reinigen', { jaehrlich: '2x' }),
  ]),
  section('Lamellen', [
    row('Lamellenreinigung (Jalousien/Sonnenschutz)', { jaehrlich: '1x' }),
  ]),
];

// ---- Winterdienst ----
const winterdienst = [
  section('Räum- und Streupflicht', [
    row('Gehwege von Schnee räumen', { bedarf: true }),
    row('Gehwege bei Glätte abstreuen', { bedarf: true }),
    row('Zufahrten/Parkplätze räumen', { bedarf: true }),
    row('Treppen und Eingangsbereiche räumen und streuen', { bedarf: true }),
  ]),
  section('Nacharbeiten', [
    row('Streugut nach Tauwetter entfernen/kehren', { bedarf: true }),
    row('Kontrolle und Nachstreuen im Tagesverlauf', { bedarf: true }),
  ]),
];

// ---- Optional Services (as add-on sections) ----
export const optionalServices = {
  glasreinigung: section('Glasreinigung (optional)', [
    row('Fenster innen und außen reinigen', { jaehrlich: '2x' }),
    row('Rahmen und Fensterbänke reinigen', { jaehrlich: '2x' }),
  ]),
  lamellenreinigung: section('Lamellenreinigung (optional)', [
    row('Lamellenreinigung (Jalousien/Sonnenschutz)', { jaehrlich: '1x' }),
  ]),
  grundreinigung: section('Grundreinigung (optional)', [
    row('Grundreinigung Böden', { jaehrlich: '1x' }),
    row('Grundreinigung Sanitärbereiche', { jaehrlich: '1x' }),
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
  // deep clone with fresh ids
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

// Content + generation logic for the Quick-Setup wizard. Replaces the old
// per-type template dropdown: instead of picking one template that instantly
// fills the LV with hard-coded intervals, the user checks which areas apply
// and picks a frequency; buildSectionsFromSetup() assembles the LV from that.

import { cloneTemplate, cloneOptionalSection } from './templates.js';

let idCounter = 100000; // separate id space from templates.js, avoids collisions
const uid = () => `q${idCounter++}-${Math.random().toString(36).slice(2, 8)}`;

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
  return { id: uid(), title, rows };
}

// Rows with column:'woechentlich', value:'' get their value filled in with
// the chosen frequency at generation time - left blank here on purpose.
export const AREA_DEFINITIONS = {
  flur: {
    label: 'Flur- und Verkehrsbereich',
    build: () =>
      section('Flur- und Verkehrsbereich', [
        row('Hartböden feucht wischen & Textilbeläge saugen', { column: 'woechentlich' }),
        row('Feuchte Reinigung der Türblätter & Türklinken', { column: 'woechentlich' }),
        row('Entfernen von Fingerabdrücken & Schlieren von Innenverglasungen, Türen & Einbauschränken', {
          column: 'woechentlich',
        }),
        row('Feuchte Reinigung der Fußleisten', { column: 'monatlich', value: '2x' }),
        row('Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken', {
          bedarf: true,
        }),
      ]),
  },
  empfang: {
    label: 'Empfangs- und Wartebereich',
    build: () =>
      section('Empfangs- und Wartebereich', [
        row('Hartböden feucht wischen & Textilbeläge saugen', { column: 'woechentlich' }),
        row('Reinigung der Oberflächen von Arbeits- & Schreibtischen', { column: 'woechentlich' }),
        row('Feuchte Reinigung der Türblätter & Türklinken', { column: 'woechentlich' }),
        row('Entfernen von Fingerabdrücken & Schlieren von Innenverglasungen, Türen & Einbauschränken', {
          column: 'woechentlich',
        }),
        row('Feuchte Reinigung der Fensterbänke & Fußleisten', { column: 'monatlich', value: '2x' }),
        row('Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken', {
          bedarf: true,
        }),
      ]),
  },
  buero: {
    label: 'Büro- und Behandlungsräume',
    build: () =>
      section('Büro- und Behandlungsräume', [
        row('Hartböden feucht wischen & Textilbeläge saugen', { column: 'woechentlich' }),
        row('Reinigung der Oberflächen von Arbeits- & Schreibtischen', { column: 'woechentlich' }),
        row('Feuchte Reinigung der Türblätter & Türklinken', { column: 'woechentlich' }),
        row('Entfernen von Fingerabdrücken & Schlieren von Innenverglasungen, Türen & Einbauschränken', {
          column: 'woechentlich',
        }),
        row('Feuchte Reinigung der Fensterbänke & Fußleisten', { column: 'monatlich', value: '2x' }),
        row('Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken', {
          bedarf: true,
        }),
      ]),
  },
  sanitaer: {
    label: 'Sanitärbereiche und Dusche',
    build: () =>
      section('Sanitärbereiche und Dusche', [
        row('Hartböden feucht wischen & Textilbeläge saugen', { column: 'woechentlich' }),
        row('Feuchte Reinigung aller Sanitärobjekte (WC, Waschbecken, Armaturen)', { column: 'woechentlich' }),
        row('WC-Oberflächen, WC-Sitze, Urinale & Spülungen säubern', { column: 'woechentlich' }),
        row('Waschbecken, Armaturen & Wandspiegel reinigen', { column: 'woechentlich' }),
        row('WC Fliesenwände reinigen', { column: 'woechentlich' }),
        row('Vollreinigung der Dusche inkl. Armaturen & Fliesen', { column: 'monatlich', value: '2x' }),
        row('Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken', {
          bedarf: true,
        }),
      ]),
  },
  kueche: {
    label: 'Küchenräume',
    build: () =>
      section('Küchenräume', [
        row('Hartböden feucht wischen & Textilbeläge saugen', { column: 'woechentlich' }),
        row('Feuchte Reinigung der Oberflächen & Arbeitsplatten', { column: 'woechentlich' }),
        row('Entfernen von Fingerabdrücken & Schlieren von Innenverglasungen, Türen, Küchen- & Einbauschränken', {
          column: 'woechentlich',
        }),
        row('Waschbecken & Armatur reinigen', { column: 'woechentlich' }),
        row('Feuchte Reinigung der Fensterbänke', { column: 'woechentlich' }),
        row('Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken', {
          bedarf: true,
        }),
      ]),
  },
  treppenhaus: {
    label: 'Treppenhaus',
    build: () =>
      section('Treppenhaus', [
        row('Hartböden feucht wischen & Textilbeläge saugen', { column: 'woechentlich' }),
        row('Feuchte Reinigung der Treppengeländer & Handläufe', { column: 'woechentlich' }),
        row('Feuchte Reinigung der Türblätter & Türklinken', { column: 'woechentlich' }),
        row('Feuchte Reinigung der Fensterbänke & Fußleisten', { column: 'monatlich', value: '2x' }),
        row('Entfernen von Staub & Spinnweben an Decken, Lampen & in Ecken', { bedarf: true }),
      ]),
  },
};

export const AREA_ORDER = ['flur', 'empfang', 'buero', 'sanitaer', 'kueche', 'treppenhaus'];

function buildGlasSection(glas) {
  const rows = [
    row('Reinigung der Glasflächen innen und außen', { column: 'aufAnfrage', value: 'Ja' }),
    row('Entfernung von Verschmutzungen wie Staub, Fingerabdrücken und Schmierrückständen', {
      column: 'aufAnfrage',
      value: 'Ja',
    }),
  ];
  if (glas.rahmen) {
    rows.push(row('Rahmenreinigung im Zuge der Glasreinigung', { column: 'aufAnfrage', value: 'Ja' }));
  }
  if (glas.lamellen) {
    rows.push(
      row('Lamellenreinigung (Jalousien/Sonnenschutz)', {
        column: 'jaehrlich',
        value: glas.lamellenFreq || '1x',
      })
    );
  }
  return section('Glasreinigung', rows);
}

function buildErstreinigungSection(stunden) {
  const std = Number(stunden) || 0;
  const total = (std * 32).toFixed(2);
  return section('Erstreinigung', [
    row(`Einmalige Erstreinigung (${std} Std. à 32,00 EUR = ${total} EUR)`, { bedarf: true }),
  ]);
}

// setup = {
//   frequency: '2x',
//   areas: { flur: bool, empfang: bool, buero: bool, sanitaer: bool, kueche: bool, treppenhaus: bool },
//   glas: { enabled, rahmen, lamellen, lamellenFreq },
//   grundreinigung: bool, winterdienst: bool, hausmeisterservice: bool,
//   erstreinigung: { enabled, stunden },
// }
//
// Glasreinigung und Winterdienst bilden jeweils ein eigenständiges,
// verknüpftes Leistungsverzeichnis statt zusätzlicher Sektionen im
// Unterhaltsreinigungs-LV - deshalb liegen sie unter `children`, nicht in
// `main`.
export function buildSectionsFromSetup(setup) {
  const main = [];

  AREA_ORDER.forEach((key) => {
    if (!setup.areas?.[key]) return;
    const built = AREA_DEFINITIONS[key].build();
    built.rows = built.rows.map((r) =>
      r.intervalColumn === 'woechentlich' && !r.intervalValue
        ? { ...r, intervalValue: setup.frequency }
        : r
    );
    main.push(built);
  });

  if (setup.grundreinigung) {
    const s = cloneOptionalSection('grundreinigung');
    if (s) main.push(s);
  }

  if (setup.hausmeisterservice) {
    main.push(
      section('Hausmeisterservice', [
        row('Allgemeine Hausmeistertätigkeiten nach Absprache', { bedarf: true }),
      ])
    );
  }

  if (setup.erstreinigung?.enabled) {
    main.push(buildErstreinigungSection(setup.erstreinigung.stunden));
  }

  const children = [];

  if (setup.glas?.enabled) {
    children.push({
      docType: 'glasreinigung',
      lvTitle: 'Leistungsverzeichnis Glasreinigung',
      sections: [buildGlasSection(setup.glas)],
    });
  }

  if (setup.winterdienst) {
    children.push({
      docType: 'winterdienst',
      lvTitle: 'Leistungsverzeichnis Winterdienst',
      sections: cloneTemplate('winterdienst'),
    });
  }

  return { main, children };
}

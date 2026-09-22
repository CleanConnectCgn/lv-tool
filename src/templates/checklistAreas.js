// Inhalt + Aufbaulogik für den Quick-Setup-Assistenten. Ersetzt das alte
// Vorlagen-Dropdown: statt eine Vorlage zu wählen, die das LV sofort mit fest
// verdrahteten Intervallen füllt, hakt man die zutreffenden Bereiche ab und
// wählt eine Frequenz; buildSectionsFromSetup() setzt das LV daraus zusammen.
//
// Zwei Konventionen, die aus der Auswertung von 142 ausgelieferten LVs
// stammen (siehe LEARNINGS-2026-09-22.md):
//
// 1. Jede Katalogzeile führt neben der Kurzbezeichnung (`text`) eine
//    ausformulierte, vertragsfeste `beschreibung`. Genau dieser Langtext
//    wurde bis jetzt bei jedem Objekt von Hand in die Bemerkungsspalte
//    getippt.
// 2. Das Wort "desinfizieren/desinfizierend" kommt im gesamten Katalog nicht
//    mehr vor. Es sichert eine Wirkung zu (Flächendesinfektion mit
//    Einwirkzeit), die in einer Unterhaltsreinigung nicht geschuldet ist -
//    und wurde in der Praxis ohnehin vor jedem Versand wieder herausgelöscht.

import { cloneTemplate, cloneOptionalSection, newSection } from './templates.js';

let idCounter = 100000; // eigener Id-Raum, kollidiert nicht mit templates.js
const uid = () => `q${idCounter++}-${Math.random().toString(36).slice(2, 8)}`;

function row(text, opts = {}) {
  return {
    id: uid(),
    text,
    bedarf: !!opts.bedarf,
    intervalColumn: opts.bedarf ? '' : opts.column || '',
    intervalValue: opts.bedarf ? '' : opts.value || '',
    bemerkung: opts.bemerkung || '',
    beschreibung: opts.beschreibung || '',
    wochentage: opts.wochentage || [],
  };
}

function section(title, rows) {
  return { id: uid(), title, rows };
}

// Beschreibungen, die in mehreren Bereichen wortgleich auftauchen. Einmal
// definiert, damit sie nicht auseinanderlaufen.
const B = {
  staubSpinnweben:
    'Entfernung von Staub, Spinnweben und sonstigen losen Verschmutzungen an Decken, Leuchten, Wandleuchten, Heizkörpern sowie in Ecken und schwer zugänglichen Bereichen.',
  abfall:
    'Entleerung der vorhandenen Abfallbehälter einschließlich Austausch der Abfallbeutel und ordnungsgemäße Entsorgung des anfallenden Abfalls.',
  tueren:
    'Feuchte Reinigung der Türblätter und Türklinken einschließlich Entfernung von Fingerabdrücken, Handabdrücken und sonstigen Verschmutzungen.',
  schalter:
    'Feuchte Reinigung der Lichtschalter und Steckdosenrahmen einschließlich Entfernung von Griffspuren und Fingerabdrücken.',
  glasInnen:
    'Entfernung von Fingerabdrücken, Handabdrücken und Schlieren an Innenverglasungen, Glastüren und Einbauschränken.',
  fensterbaenkeFussleisten:
    'Feuchte Reinigung der Fensterbänke und Fußleisten einschließlich Entfernung von Staub und oberflächlichen Verschmutzungen.',
};

// Zeilen mit column:'woechentlich' und leerem value bekommen die im
// Assistenten gewählte Frequenz - hier bewusst leer gelassen.
export const AREA_DEFINITIONS = {
  flur: {
    label: 'Flur- und Verkehrsbereich',
    build: () =>
      section('Flur- und Verkehrsbereich', [
        row('Hartböden feucht wischen & Textilbeläge saugen', {
          column: 'woechentlich',
          beschreibung:
            'Feuchte Reinigung der Hartbodenflächen und gründliches Absaugen der textilen Bodenbeläge in den Flur- und Verkehrsbereichen einschließlich Entfernung von Schmutz, Staub und sonstigen oberflächlichen Verunreinigungen.',
        }),
        row('Feuchte Reinigung der Türblätter & Türklinken', {
          column: 'woechentlich',
          beschreibung: B.tueren,
        }),
        row('Lichtschalter & Steckdosenrahmen feucht abwischen', {
          column: 'woechentlich',
          beschreibung: B.schalter,
        }),
        row('Entfernen von Fingerabdrücken & Schlieren von Innenverglasungen, Türen & Einbauschränken', {
          column: 'woechentlich',
          beschreibung: B.glasInnen,
        }),
        row('Abfallbehälter leeren inkl. Austausch der Beutel', {
          column: 'woechentlich',
          beschreibung: B.abfall,
        }),
        row('Feuchte Reinigung der Fußleisten', {
          column: 'monatlich',
          value: '2x',
          beschreibung:
            'Feuchte Reinigung der Fußleisten einschließlich Entfernung von Staub und oberflächlichen Verschmutzungen.',
        }),
        row('Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken', {
          bedarf: true,
          beschreibung: B.staubSpinnweben,
        }),
      ]),
  },

  // Für Wohnanlagen/WEG: Eingangsbereich mit Hauseingangstür, Schmutzfang,
  // Briefkasten- und Klingelanlage. Aus den LVs Rhöndorfer Str. 8 und
  // Herthastraße 6 (22.09.2026) übernommen.
  eingangsbereich: {
    label: 'Flur- und Eingangsbereich (Wohnanlage)',
    build: () =>
      section('Flur- und Eingangsbereich', [
        row('Hartböden feucht wischen', {
          column: 'woechentlich',
          beschreibung:
            'Feuchte Reinigung der Hartbodenflächen in den Flur- und Verkehrsbereichen einschließlich Entfernung von Schmutz, Staub und sonstigen oberflächlichen Verunreinigungen.',
        }),
        row('Textilbeläge in den Fluren saugen', {
          column: 'woechentlich',
          value: '1x',
          beschreibung: 'Gründliches Absaugen der textilen Bodenbeläge in den Flur- und Verkehrsbereichen.',
        }),
        row('Feuchte Reinigung der Hauseingangstür', {
          column: 'woechentlich',
          value: '1x',
          beschreibung:
            'Feuchte Reinigung der Türblätter und Türklinken der Hauseingangstür einschließlich Entfernung von Fingerabdrücken und sonstigen Verschmutzungen.',
        }),
        row('Schmutzfang an der Hauseingangstür', {
          column: 'woechentlich',
          beschreibung:
            'Aufnehmen, Ausklopfen und Reinigung der Schmutzfangmatten einschließlich Entfernung von losem Schmutz und Verunreinigungen.',
        }),
        row('Briefkasten- & Klingelanlage', {
          column: 'woechentlich',
          value: '1x',
          beschreibung:
            'Feuchte Reinigung der Briefkasten- und Klingelanlagen einschließlich Entfernung von Staub, Fingerabdrücken und sonstigen oberflächlichen Verschmutzungen.',
        }),
        row('Zwischentüren', {
          bedarf: true,
          beschreibung:
            'Entfernung von Fingerabdrücken, Handabdrücken und Schlieren an den Türblättern und Türgriffen der Zwischentüren.',
        }),
        row('Staub & Spinnweben', {
          bedarf: true,
          beschreibung: B.staubSpinnweben,
        }),
      ]),
  },

  empfang: {
    label: 'Empfangs- und Wartebereich',
    build: () =>
      section('Empfangs- und Wartebereich', [
        row('Hartböden feucht wischen & Textilbeläge saugen', {
          column: 'woechentlich',
          beschreibung:
            'Feuchte Reinigung der Hartbodenflächen und gründliches Absaugen der textilen Bodenbeläge einschließlich Entfernung von Schmutz, Staub und sonstigen oberflächlichen Verunreinigungen.',
        }),
        row('Reinigung der Oberflächen von Arbeits- & Schreibtischen', {
          column: 'woechentlich',
          beschreibung:
            'Feuchte Reinigung der freigeräumten Oberflächen von Tresen, Arbeits- und Schreibtischen einschließlich Entfernung von Staub und oberflächlichen Verschmutzungen.',
        }),
        row('Feuchte Reinigung der Türblätter & Türklinken', {
          column: 'woechentlich',
          beschreibung: B.tueren,
        }),
        row('Sitzflächen & Wartebereich-Möbel feucht abwischen', {
          column: 'woechentlich',
          beschreibung:
            'Feuchte Reinigung der Sitzflächen, Armlehnen und Beistelltische im Wartebereich einschließlich Entfernung von Griffspuren und oberflächlichen Verschmutzungen.',
        }),
        row('Telefone & Klingelanlage feucht abwischen', {
          column: 'woechentlich',
          beschreibung:
            'Feuchte Reinigung der Telefone und der Klingelanlage einschließlich Entfernung von Staub und Griffspuren.',
        }),
        row('Entfernen von Fingerabdrücken & Schlieren von Innenverglasungen, Türen & Einbauschränken', {
          column: 'woechentlich',
          beschreibung: B.glasInnen,
        }),
        row('Abfallbehälter leeren inkl. Austausch der Beutel', {
          column: 'woechentlich',
          beschreibung: B.abfall,
        }),
        row('Feuchte Reinigung der Fensterbänke & Fußleisten', {
          column: 'monatlich',
          value: '2x',
          beschreibung: B.fensterbaenkeFussleisten,
        }),
        row('Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken', {
          bedarf: true,
          beschreibung: B.staubSpinnweben,
        }),
      ]),
  },

  buero: {
    label: 'Büroräume',
    build: () =>
      section('Büroräume', [
        row('Hartböden feucht wischen & Textilbeläge saugen', {
          column: 'woechentlich',
          beschreibung:
            'Feuchte Reinigung der Hartbodenflächen und gründliches Absaugen der textilen Bodenbeläge einschließlich Entfernung von Schmutz, Staub und sonstigen oberflächlichen Verunreinigungen.',
        }),
        row('Reinigung der Oberflächen von Arbeits- & Schreibtischen (nur freigeräumte Flächen)', {
          column: 'woechentlich',
          beschreibung:
            'Feuchte Reinigung der freigeräumten Oberflächen von Arbeits- und Schreibtischen. Belegte Flächen, Unterlagen und persönliche Gegenstände werden nicht verschoben.',
        }),
        row('Feuchte Reinigung der Türblätter & Türklinken', {
          column: 'woechentlich',
          beschreibung: B.tueren,
        }),
        row('Lichtschalter & Steckdosenrahmen feucht abwischen', {
          column: 'woechentlich',
          beschreibung: B.schalter,
        }),
        row('Entfernen von Fingerabdrücken & Schlieren von Innenverglasungen, Türen & Einbauschränken', {
          column: 'woechentlich',
          beschreibung: B.glasInnen,
        }),
        row('Abfallbehälter leeren inkl. Austausch der Beutel', {
          column: 'woechentlich',
          beschreibung: B.abfall,
        }),
        row('Bildschirme, Tastaturen & Telefone entstauben', {
          column: 'monatlich',
          value: '1x',
          beschreibung:
            'Entstauben der Bildschirme, Tastaturen und Telefone. Geräte werden dabei nicht bewegt oder vom Strom getrennt.',
        }),
        row('Feuchte Reinigung der Fensterbänke & Fußleisten', {
          column: 'monatlich',
          value: '2x',
          beschreibung: B.fensterbaenkeFussleisten,
        }),
        row('Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken', {
          bedarf: true,
          beschreibung: B.staubSpinnweben,
        }),
      ]),
  },

  // Bis 2026-08-26 fest mit "Büroräume" zu einem gemeinsamen Bereich
  // gebündelt - nicht jeder Kunde mit Büroflächen hat auch Behandlungsräume
  // (und umgekehrt), deshalb eigenständig auswählbar.
  behandlungsraeume: {
    label: 'Behandlungsräume',
    build: () =>
      section('Behandlungsräume', [
        row('Hartböden feucht wischen', {
          column: 'woechentlich',
          beschreibung:
            'Feuchte Reinigung der Hartbodenflächen einschließlich Entfernung von Schmutz, Staub und sonstigen oberflächlichen Verunreinigungen.',
        }),
        row('Behandlungsliegen & -stühle (Auflageflächen) feucht abwischen', {
          column: 'woechentlich',
          beschreibung:
            'Feuchte Reinigung der Auflageflächen von Behandlungsliegen und -stühlen. Die hygienische Aufbereitung der Behandlungsflächen selbst verbleibt beim Auftraggeber.',
          bemerkung: 'Keine Behandlungsflächen.',
        }),
        row('Arbeitsflächen & Ablagen feucht abwischen', {
          column: 'woechentlich',
          beschreibung:
            'Feuchte Reinigung der freigeräumten Arbeitsflächen und Ablagen einschließlich Entfernung von Staub und oberflächlichen Verschmutzungen.',
          bemerkung: 'Keine Behandlungsflächen.',
        }),
        row('Feuchte Reinigung der Türblätter & Türklinken', {
          column: 'woechentlich',
          beschreibung: B.tueren,
        }),
        row('Lichtschalter & Steckdosenrahmen feucht abwischen', {
          column: 'woechentlich',
          beschreibung: B.schalter,
        }),
        row('Entfernen von Fingerabdrücken & Schlieren von Innenverglasungen & Türen', {
          column: 'woechentlich',
          beschreibung: B.glasInnen,
        }),
        row('Abfallbehälter leeren inkl. Austausch der Beutel', {
          column: 'woechentlich',
          beschreibung: B.abfall,
          bemerkung: 'Sonderabfall wird nicht entsorgt.',
        }),
        row('Feuchte Reinigung der Fensterbänke & Fußleisten', {
          column: 'monatlich',
          value: '2x',
          beschreibung: B.fensterbaenkeFussleisten,
        }),
        row('Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken', {
          bedarf: true,
          beschreibung: B.staubSpinnweben,
        }),
      ]),
  },

  sanitaer: {
    label: 'Sanitärbereiche',
    build: () =>
      section('Sanitärbereiche', [
        row('Hartböden feucht wischen', {
          column: 'woechentlich',
          beschreibung:
            'Feuchte Reinigung der Hartbodenflächen einschließlich Spritzbereich und Entfernung von Schmutz und oberflächlichen Verunreinigungen.',
          bemerkung: 'Reinigung mit Sanitär- und Hygienereiniger.',
        }),
        row('WC-Oberflächen, WC-Sitze, Urinale & Spülungen säubern', {
          column: 'woechentlich',
          beschreibung:
            'Reinigung der WC-Becken, WC-Sitze, Urinale, Spülkästen und des angrenzenden Spritzbereichs einschließlich Entfernung von Urin- und Kalkansätzen.',
        }),
        row('Waschbecken, Armaturen & Wandspiegel reinigen', {
          column: 'woechentlich',
          beschreibung:
            'Reinigung und Politur von Waschbecken, Armaturen, Ablagen und Wandspiegeln einschließlich Entfernung von Kalkansätzen, Fingerabdrücken und Rückständen.',
        }),
        row('WC Fliesenwände reinigen', {
          column: 'woechentlich',
          beschreibung:
            'Feuchte Reinigung der Fliesen-, Scham- und Trennwände im Spritzwasserbereich einschließlich Entfernung von Rückständen.',
        }),
        row('Seifen-, Handtuch- & Hygienespender kontrollieren und auffüllen', {
          column: 'woechentlich',
          beschreibung:
            'Kontrolle und Auffüllen von Flüssigseife, Papierhandtüchern und Toilettenpapier sowie feuchte Reinigung der Spendergehäuse.',
          bemerkung: 'Verbrauchsmaterial wird vom Auftragnehmer gestellt und gesondert berechnet.',
        }),
        row('Abfallbehälter leeren inkl. Austausch der Beutel', {
          column: 'woechentlich',
          beschreibung: B.abfall,
        }),
        row('Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken', {
          bedarf: true,
          beschreibung: B.staubSpinnweben,
        }),
      ]),
  },

  // Bis 2026-08-26 eine Zeile innerhalb von "Sanitärbereiche und Dusche" -
  // nicht jedes Sanitärobjekt hat eine Dusche, und es gibt separate
  // Duschräume ohne WC.
  dusche: {
    label: 'Dusche',
    build: () =>
      section('Dusche', [
        row('Vollreinigung der Dusche inkl. Armaturen & Fliesen', {
          column: 'woechentlich',
          beschreibung:
            'Reinigung von Duschwanne bzw. -kabine, Armaturen, Duschkopf und angrenzenden Fliesenflächen einschließlich Entfernung von Seifen- und Kalkrückständen.',
        }),
        row('Duschwanne/-kabine entkalken', {
          column: 'monatlich',
          value: '2x',
          beschreibung:
            'Entkalken von Duschwanne bzw. -kabine, Armaturen und Glasabtrennungen einschließlich Entfernung hartnäckiger Kalkablagerungen.',
        }),
        row('Abflüsse auf Durchgängigkeit prüfen & reinigen', {
          column: 'monatlich',
          value: '1x',
          beschreibung:
            'Sichtprüfung der Abläufe auf Durchgängigkeit sowie Reinigung der zugänglichen Ablaufsiebe. Rohrreinigungsarbeiten sind nicht enthalten.',
        }),
        row('Entfernen von Staub & Spinnweben an Decken, Lampen & in Ecken', {
          bedarf: true,
          beschreibung: B.staubSpinnweben,
        }),
      ]),
  },

  kueche: {
    label: 'Küchenräume',
    build: () =>
      section('Küchenräume', [
        row('Hartböden feucht wischen & Textilbeläge saugen', {
          column: 'woechentlich',
          beschreibung:
            'Feuchte Reinigung der Hartbodenflächen und gründliches Absaugen der textilen Bodenbeläge einschließlich Entfernung von Schmutz, Staub und sonstigen oberflächlichen Verunreinigungen.',
        }),
        row('Feuchte Reinigung der Oberflächen & Arbeitsplatten', {
          column: 'woechentlich',
          beschreibung:
            'Feuchte Reinigung der freigeräumten Arbeitsplatten, Ober- und Ablageflächen einschließlich Entfernung von Speiseresten und oberflächlichen Verschmutzungen.',
        }),
        row('Entfernen von Fingerabdrücken & Schlieren von Innenverglasungen, Türen, Küchen- & Einbauschränken', {
          column: 'woechentlich',
          beschreibung:
            'Entfernung von Griffspuren, Fingerabdrücken und Schlieren an Küchen- und Einbauschränken, Glastüren und Innenverglasungen.',
        }),
        row('Waschbecken & Armatur reinigen', {
          column: 'woechentlich',
          beschreibung:
            'Reinigung und Politur von Spüle, Armatur und Ausguss einschließlich Entfernung von Kalkansätzen und Rückständen.',
        }),
        row('Küchengeräte außen abwischen (Mikrowelle, Kaffeemaschine, Kühlschrank)', {
          column: 'woechentlich',
          beschreibung:
            'Feuchte Reinigung der Außenflächen von Mikrowelle, Kaffeemaschine, Kühlschrank und Geschirrspüler. Die Innenreinigung ist nicht enthalten.',
        }),
        row('Feuchte Reinigung der Fensterbänke', {
          column: 'woechentlich',
          beschreibung:
            'Feuchte Reinigung der Fensterbänke, sofern frei und zugänglich.',
        }),
        row('Abfall trennen und entsorgen (Restmüll, Papier, Glas nach Vorgabe)', {
          column: 'woechentlich',
          beschreibung:
            'Entleerung der Abfallbehälter, Austausch der Abfallbeutel und Zuführung des getrennten Abfalls zu den vorgesehenen Sammelstellen.',
        }),
        row('Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken', {
          bedarf: true,
          beschreibung: B.staubSpinnweben,
        }),
      ]),
  },

  treppenhaus: {
    label: 'Treppenhaus',
    build: () =>
      section('Treppenhaus', [
        row('Hartböden feucht wischen & Textilbeläge saugen', {
          column: 'woechentlich',
          beschreibung:
            'Feuchte Reinigung der Bodenflächen und Treppenstufen einschließlich Entfernung von Schmutz und sonstigen oberflächlichen Verunreinigungen.',
        }),
        row('Feuchte Reinigung der Treppengeländer & Handläufe', {
          column: 'woechentlich',
          beschreibung:
            'Feuchte Reinigung der Treppengeländer, Handläufe und sonstigen Griffbereiche einschließlich Entfernung von Staub, Fingerabdrücken und Verschmutzungen.',
        }),
        row('Feuchte Reinigung der Türblätter & Türklinken', {
          column: 'woechentlich',
          beschreibung:
            'Feuchte Reinigung der Türblätter und Türklinken im Treppenhaus einschließlich Entfernung von Fingerabdrücken, Handabdrücken und sonstigen Verschmutzungen.',
        }),
        row('Briefkastenanlage & Klingelanlage abwischen', {
          column: 'woechentlich',
          beschreibung:
            'Feuchte Reinigung der Briefkasten- und Klingelanlagen einschließlich Entfernung von Staub, Fingerabdrücken und sonstigen oberflächlichen Verschmutzungen.',
        }),
        row('Fußmatten reinigen (schütteln, saugen oder nass abwischen je nach Typ)', {
          column: 'woechentlich',
          beschreibung:
            'Aufnehmen, Ausklopfen und Reinigung der Schmutzfangmatten einschließlich Entfernung von losem Schmutz und Verunreinigungen.',
        }),
        row('Feuchte Reinigung der Fensterbänke & Fußleisten', {
          column: 'monatlich',
          value: '2x',
          beschreibung: B.fensterbaenkeFussleisten,
        }),
        row('Entfernen von Staub & Spinnweben an Decken, Lampen & in Ecken', {
          bedarf: true,
          beschreibung: B.staubSpinnweben,
        }),
      ]),
  },

  // Wohnanlage: Aufzug als eigene Position, nicht als Nebensatz im Flur.
  aufzug: {
    label: 'Aufzug',
    build: () =>
      section('Aufzug', [
        row('Aufzugskabine reinigen', {
          column: 'woechentlich',
          beschreibung:
            'Reinigung der Aufzugsinnenflächen, insbesondere Boden, Wandflächen und Bedienfeld, einschließlich Entfernung von Fingerabdrücken und sonstigen Verschmutzungen.',
        }),
        row('Türlaufschienen & Schwellen reinigen', {
          column: 'monatlich',
          value: '1x',
          beschreibung:
            'Reinigung der Türlaufschienen und Schwellen einschließlich Entfernung von losem Schmutz und Ablagerungen.',
        }),
        row('Staub & Spinnweben', {
          bedarf: true,
          beschreibung: B.staubSpinnweben,
        }),
      ]),
  },

  // Wohnanlage: aus den LVs Rhöndorfer Str. 8 / Herthastraße 6 übernommen.
  kellerWaschraum: {
    label: 'Keller und Waschraum',
    build: () =>
      section('Keller und Waschraum', [
        row('Hartböden feucht wischen', {
          column: 'woechentlich',
          value: '1x',
          beschreibung:
            'Kehren bzw. feuchte Reinigung der zugänglichen Hartbodenflächen im Keller- und Waschraumbereich einschließlich Entfernung von Schmutz und sonstigen oberflächlichen Verunreinigungen.',
        }),
        row('Abfallbehälter leeren', {
          column: 'woechentlich',
          value: '1x',
          beschreibung: B.abfall,
        }),
        row('Staub & Spinnweben', {
          bedarf: true,
          beschreibung:
            'Entfernung von Staub, Spinnweben und sonstigen losen Verschmutzungen an Decken, Leuchten, Wandleuchten, Heizkörpern sowie in Ecken und zugänglichen Bereichen.',
        }),
        row('Abgestellte Gegenstände werden nicht verschoben oder entsorgt', {
          bedarf: true,
          beschreibung:
            'Privates Eigentum, Kellerabteile und abgestellte Gegenstände werden nicht angefasst, verschoben oder entsorgt.',
        }),
      ]),
  },

  archivlager: {
    label: 'Archiv / Lager (nur Boden, keine Akten/Waren)',
    build: () =>
      section('Archiv / Lager', [
        row('Hartböden feucht wischen bzw. kehren (Gänge und Freiflächen)', {
          column: 'woechentlich',
          beschreibung:
            'Kehren bzw. feuchte Reinigung der zugänglichen Hartbodenflächen in Gängen und Freiflächen einschließlich Entfernung von Schmutz und oberflächlichen Verunreinigungen.',
        }),
        row('Abfallbehälter leeren inkl. Austausch der Beutel', {
          column: 'woechentlich',
          beschreibung: B.abfall,
        }),
        row('Akten, Unterlagen, Waren & Regale werden nicht angefasst oder verschoben', {
          bedarf: true,
          beschreibung:
            'Akten, Unterlagen, Waren und Regalinhalte werden nicht angefasst, verschoben oder entstaubt.',
        }),
        row('Entfernen von Staub & Spinnweben an Decken, Lampen & in Ecken', {
          bedarf: true,
          beschreibung: B.staubSpinnweben,
        }),
      ]),
  },

  kinderbereich: {
    label: 'Gruppen-/Kinderbereich',
    build: () =>
      section('Gruppen-/Kinderbereich', [
        row('Hartböden feucht wischen & Textilbeläge saugen', {
          column: 'woechentlich',
          beschreibung:
            'Feuchte Reinigung der Hartbodenflächen und gründliches Absaugen der textilen Bodenbeläge einschließlich Entfernung von Schmutz, Staub und sonstigen oberflächlichen Verunreinigungen.',
        }),
        row('Tische & Stühle (alle Kontaktflächen) feucht abwischen', {
          column: 'woechentlich',
          beschreibung:
            'Feuchte Reinigung der Tisch- und Sitzflächen sowie der Rückenlehnen einschließlich Entfernung von Speiseresten und Griffspuren.',
        }),
        row('Türklinken & Lichtschalter feucht abwischen', {
          column: 'woechentlich',
          beschreibung: B.schalter,
        }),
        row('Wickelbereich reinigen (falls vorhanden)', {
          column: 'woechentlich',
          beschreibung:
            'Feuchte Reinigung der Wickelauflage und der angrenzenden Flächen einschließlich Entfernung von oberflächlichen Verschmutzungen.',
        }),
        row('Abfallbehälter leeren inkl. Austausch der Beutel', {
          column: 'woechentlich',
          beschreibung: B.abfall,
        }),
        row('Spielzeug wird nicht gereinigt oder bewegt (pädagogisches Eigentum)', {
          bedarf: true,
          beschreibung:
            'Spielzeug, Bastelmaterial und pädagogisches Eigentum werden nicht gereinigt, bewegt oder umgeräumt.',
        }),
        row('Entfernen von Staub & Spinnweben an Decken, Lampen & in Ecken', {
          bedarf: true,
          beschreibung: B.staubSpinnweben,
        }),
      ]),
  },

  // Bis 2026-09-22 erzeugte der Hausmeisterservice-Haken genau EINE Zeile
  // ("Allgemeine Hausmeistertätigkeiten nach Absprache"). Die tatsächlich
  // ausgelieferten Positionen stammen aus Rhöndorfer Str. 8 / Herthastraße 6.
  hausmeisterservice: {
    label: 'Hausmeisterservice',
    build: () =>
      section('Hausmeisterservice', [
        row('Tonnenservice / Abfallentsorgung', {
          column: 'woechentlich',
          beschreibung:
            'Bereitstellung und Rückstellung der Abfallbehälter zu den Abholterminen sowie Entfernung und ordnungsgemäße Zuordnung von Kleinstmüll aus dem Sperrmüll-/Entrümpelungsraum im Rahmen des Mülltonnenservices.',
        }),
        row('Kontrollgang Allgemeinbereiche', {
          column: 'woechentlich',
          beschreibung:
            'Regelmäßiger Kontrollgang durch die Allgemein-, Flur-, Verkehrs- und Fluchtbereiche auf erkennbare Verschmutzungen, Beschädigungen, Vandalismus, defekte Leuchtmittel, abgestellte Gegenstände und sonstige Auffälligkeiten. Festgestellte Mängel werden der Hausverwaltung gemeldet.',
        }),
        row('Kontrolle Sperrmüll-/Entrümpelungsraum', {
          column: 'woechentlich',
          value: '1x',
          beschreibung:
            'Kontrolle des Sperrmüll-/Entrümpelungsraums auf abgestellte Gegenstände, Verschmutzungen und ordnungswidrige Ablagerungen.',
        }),
        row('Kontrolle der Flucht- und Verkehrswege', {
          column: 'woechentlich',
          value: '1x',
          beschreibung:
            'Kontrolle der Allgemein-, Verkehrs- und Fluchtwege auf abgestellte Möbel, Schuhschränke, Gegenstände und sonstige Behinderungen. Bei festgestellten Verstößen erfolgt ein Hinweis an die Bewohner bzw. eine Information an die Hausverwaltung.',
        }),
        row('Kontrolle und Pflege der Mülltonnenstandplätze', {
          column: 'woechentlich',
          value: '1x',
          beschreibung:
            'Kontrolle der Mülltonnenstandplätze auf Verschmutzungen, Fehlbefüllungen und ordnungsgemäßen Zustand.',
        }),
        row('Entrümpelung / Entfernung von Gegenständen', {
          bedarf: true,
          beschreibung:
            'Entrümpelung des Sperrmüll-/Entrümpelungsraums sowie Entfernung bzw. Verbringung abgestellter Gegenstände aus Allgemein- und Verkehrsbereichen nach vorheriger Beauftragung durch die Hausverwaltung.',
        }),
      ]),
  },
};

export const AREA_ORDER = [
  'flur',
  'eingangsbereich',
  'empfang',
  'buero',
  'behandlungsraeume',
  'sanitaer',
  'dusche',
  'kueche',
  'treppenhaus',
  'aufzug',
  'kellerWaschraum',
  'archivlager',
  'kinderbereich',
  'hausmeisterservice',
];

// Objekttypen als Startpunkt: hakt die Bereiche vor, die bei dieser Art von
// Objekt fast immer zutreffen, und setzt eine übliche Frequenz. Alles bleibt
// danach einzeln abwählbar - das ist ein Vorschlag, keine feste Vorlage.
// Die Zuschnitte stammen aus der Auswertung der bisher erstellten LVs.
export const OBJEKT_TYPEN = {
  buero: {
    label: 'Büro',
    frequency: '2x',
    areas: ['flur', 'buero', 'sanitaer', 'kueche'],
  },
  praxis: {
    label: 'Arztpraxis / Therapie',
    frequency: '3x',
    areas: ['flur', 'empfang', 'buero', 'behandlungsraeume', 'sanitaer', 'kueche'],
  },
  wohnanlage: {
    label: 'Wohnanlage / WEG',
    frequency: '2x',
    areas: ['eingangsbereich', 'treppenhaus', 'aufzug', 'kellerWaschraum', 'hausmeisterservice'],
  },
  gewerbe: {
    label: 'Gewerbe / Halle',
    frequency: '2x',
    areas: ['flur', 'buero', 'sanitaer', 'dusche', 'kueche', 'archivlager'],
  },
  kita: {
    label: 'Kita / Betreuung',
    frequency: '5x',
    areas: ['flur', 'kinderbereich', 'sanitaer', 'kueche'],
  },
  ladenlokal: {
    label: 'Ladenlokal / Praxisnahe Fläche',
    frequency: '2x',
    areas: ['flur', 'empfang', 'sanitaer', 'kueche'],
  },
};

export const OBJEKT_TYP_ORDER = ['buero', 'praxis', 'wohnanlage', 'gewerbe', 'kita', 'ladenlokal'];

// Liefert das `areas`-Objekt für einen Objekttyp (alle Schlüssel gesetzt,
// die nicht zum Typ gehören auf false), damit der Assistent es direkt in
// seinen State übernehmen kann.
export function areasForObjektTyp(typKey) {
  const typ = OBJEKT_TYPEN[typKey];
  const areas = Object.fromEntries(AREA_ORDER.map((k) => [k, false]));
  if (!typ) return areas;
  typ.areas.forEach((k) => {
    if (k in areas) areas[k] = true;
  });
  return areas;
}

function buildGlasSection(glas) {
  const rows = [
    row('Reinigung der Glasflächen innen und außen', {
      column: 'aufAnfrage',
      value: 'Ja',
      beschreibung:
        'Streifen- und schlierenfreie Reinigung der vereinbarten Glasflächen an Fenstern, Glaswänden und Trennwänden. Außenreinigung nur bei öffnungsfähigen bzw. erreichbaren Flächen und sofern keine festen Gitter oder Hindernisse vorhanden sind.',
    }),
    row('Entfernung von Verschmutzungen wie Staub, Fingerabdrücken und Schmierrückständen', {
      column: 'aufAnfrage',
      value: 'Ja',
      beschreibung:
        'Entfernung von Staub, Fingerabdrücken, Schlieren und Schmierrückständen ohne sichtbare Rückstände.',
    }),
  ];
  if (glas.rahmen) {
    rows.push(
      row('Rahmenreinigung im Zuge der Glasreinigung', {
        column: 'aufAnfrage',
        value: 'Ja',
        beschreibung:
          'Reinigung von Rahmen, Falzen, Dichtungen, Griffen und Fensterbänken, soweit frei zugänglich und ausdrücklich vereinbart.',
      })
    );
  }
  if (glas.lamellen) {
    rows.push(
      row('Lamellenreinigung (Jalousien/Sonnenschutz)', {
        column: 'jaehrlich',
        value: glas.lamellenFreq || '1x',
        beschreibung:
          'Reinigung der Lamellen bzw. Jalousien einschließlich Entfernung von Staub und oberflächlichen Verschmutzungen. Beschädigte oder verzogene Elemente werden nicht bearbeitet.',
      })
    );
  }
  return section('Glasreinigung', rows);
}

function buildErstreinigungSection(stunden) {
  const std = Number(stunden) || 0;
  const total = (std * 32).toFixed(2);
  return section('Erstreinigung', [
    row(`Einmalige Erstreinigung (${std} Std. à 32,00 EUR = ${total} EUR)`, {
      bedarf: true,
      beschreibung:
        'Einmalige Herstellung des reinigungsfähigen Zustands vor Aufnahme der laufenden Unterhaltsreinigung. Abrechnung nach tatsächlichem Aufwand.',
    }),
  ]);
}

const SINGLE_SERVICE_TITLES = {
  glasreinigung: 'Leistungsverzeichnis Glasreinigung',
  grundreinigung: 'Leistungsverzeichnis Grundreinigung',
};

// Eigenständiges LV NUR für eine Einzelleistung (z.B. nur Glasreinigung),
// ohne die sonst erzwungene Unterhaltsreinigungs-Basis - anders als
// buildSectionsFromSetup() landet die Leistung hier direkt in `main`, und der
// Titel richtet sich nach der gewählten Leistung.
export function buildSingleServiceMain(serviceKey, customTitle) {
  if (serviceKey === 'sonstiges') {
    const title = (customTitle || '').trim() || 'Sonstige Leistung';
    return { main: [newSection(title)], lvTitle: `Leistungsverzeichnis ${title}` };
  }
  const cloned = cloneOptionalSection(serviceKey);
  if (!cloned) return { main: [], lvTitle: 'Leistungsverzeichnis' };
  // "(optional)"-Zusatz im Titel passt nur im Zusatzleistungs-Modus.
  cloned.title = cloned.title.replace(/\s*\(optional\)$/, '');
  return {
    main: [cloned],
    lvTitle: SINGLE_SERVICE_TITLES[serviceKey] || `Leistungsverzeichnis ${cloned.title}`,
  };
}

// setup = {
//   frequency: '2x',
//   areas: { flur: bool, empfang: bool, ... },
//   glas: { enabled, rahmen, lamellen, lamellenFreq },
//   grundreinigung: bool, winterdienst: bool, hausmeisterservice: bool,
//   erstreinigung: { enabled, stunden },
// }
//
// Glasreinigung und Winterdienst bilden jeweils ein eigenständiges,
// verknüpftes Leistungsverzeichnis statt zusätzlicher Sektionen im
// Unterhaltsreinigungs-LV - deshalb liegen sie unter `children`.
export function buildSectionsFromSetup(setup) {
  const main = [];

  AREA_ORDER.forEach((key) => {
    if (!setup.areas?.[key]) return;
    const built = AREA_DEFINITIONS[key].build();
    built.rows = built.rows.map((r) =>
      r.intervalColumn === 'woechentlich' && !r.intervalValue
        ? { ...r, intervalValue: setup.frequency, wochentage: setup.wochentage || [] }
        : r
    );
    main.push(built);
  });

  if (setup.grundreinigung) {
    const s = cloneOptionalSection('grundreinigung');
    if (s) main.push(s);
  }

  // Der separate Hausmeisterservice-Schalter im Assistenten bleibt erhalten,
  // zieht jetzt aber denselben ausformulierten Bereich wie die Bereichsliste.
  // Doppelte Sektion vermeiden, wenn beides gesetzt ist.
  if (setup.hausmeisterservice && !setup.areas?.hausmeisterservice) {
    const built = AREA_DEFINITIONS.hausmeisterservice.build();
    built.rows = built.rows.map((r) =>
      r.intervalColumn === 'woechentlich' && !r.intervalValue
        ? { ...r, intervalValue: setup.frequency, wochentage: setup.wochentage || [] }
        : r
    );
    main.push(built);
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

// Findet zu einem Bereich im LV die passende Katalogdefinition. Zuerst über
// den exakten Titel, sonst über den Titel der Definition (der Bereich kann
// im LV umbenannt worden sein, z.B. "Büroräume" -> "Büro 1. OG").
function findAreaDefinition(sectionTitle) {
  const title = (sectionTitle || '').trim().toLowerCase();
  if (!title) return null;
  const exact = AREA_ORDER.find((k) => AREA_DEFINITIONS[k].build().title.toLowerCase() === title);
  if (exact) return AREA_DEFINITIONS[exact];
  // Teiltreffer: "Sanitärbereiche EG" findet "Sanitärbereiche".
  const partial = AREA_ORDER.find((k) => {
    const defTitle = AREA_DEFINITIONS[k].build().title.toLowerCase();
    return title.includes(defTitle) || defTitle.includes(title);
  });
  return partial ? AREA_DEFINITIONS[partial] : null;
}

// Liefert die Leistungen, die für diesen Bereich üblich sind, im LV aber
// noch fehlen - als Vorschlag im Editor ("Fehlt hier was?"). Verglichen wird
// über die Kurzbezeichnung, damit eine umformulierte Zeile nicht doppelt
// vorgeschlagen wird.
export function getMissingRowsForSection(section) {
  const def = findAreaDefinition(section?.title);
  if (!def) return [];
  const vorhanden = new Set(
    (section.rows || []).map((r) => (r.text || '').trim().toLowerCase()).filter(Boolean)
  );
  return def
    .build()
    .rows.filter((r) => {
      const t = (r.text || '').trim().toLowerCase();
      if (!t || vorhanden.has(t)) return false;
      // Auch als vorhanden werten, wenn eine Zeile im LV den Katalogtext
      // enthält oder umgekehrt (z.B. "Böden feucht wischen (EG)").
      return ![...vorhanden].some((v) => v.includes(t) || t.includes(v));
    })
    .map((r) => ({
      ...r,
      id: uid(),
      // Katalogzeilen tragen bei "wöchentlich" absichtlich keinen Wert - der
      // kommt sonst aus der im Assistenten gewählten Frequenz. Beim direkten
      // Hinzufügen im Editor gibt es die nicht, also die im Bereich übliche
      // Frequenz übernehmen statt die Zeile ohne Intervall einzufügen.
      intervalValue:
        r.intervalColumn === 'woechentlich' && !r.intervalValue
          ? wochenfrequenzImBereich(section)
          : r.intervalValue,
    }));
}

// Häufigste wöchentliche Angabe innerhalb eines Bereichs, sonst im ganzen LV
// übliche Vorgabe.
function wochenfrequenzImBereich(section, fallback = '2x') {
  const zaehler = new Map();
  (section?.rows || []).forEach((r) => {
    if (r.intervalColumn === 'woechentlich' && r.intervalValue) {
      zaehler.set(r.intervalValue, (zaehler.get(r.intervalValue) || 0) + 1);
    }
  });
  if (zaehler.size === 0) return fallback;
  return [...zaehler.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

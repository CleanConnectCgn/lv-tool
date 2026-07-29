// Feld-Definitionen und DSGVO-Klausel-Varianten für den Vertragsgenerator.
//
// Struktur und Klauseltexte orientieren sich am tatsächlich verwendeten und
// unterschriebenen Referenzvertrag (VT-1264, Dr. Werner Skibba, 24.07.2026).
// Branchenspezifische Passagen (v.a. § 7.2 Datenschutz) wurden daraus
// verallgemeinert. WICHTIG: Trotzdem gilt weiterhin - vor jedem neuen
// Branchen-Anwendungsfall (insbesondere außerhalb Arztpraxis, wofür der
// Referenzvertrag bereits im Einsatz ist) sollte ein Anwalt/eine Anwältin
// gegenlesen, ob die Klauseln für den konkreten Fall passen.

// Stammdaten des Auftragnehmers - identisch zu den Angaben in den lv-tool
// PDF-Exporten/sevDesk-Angeboten (src/lib/lvPdfExport.js FOOTER_COLS) und im
// Referenzvertrag.
export const AUFTRAGNEHMER = {
  firma: 'Clean Connect Gebäudereinigung UG',
  strasse: 'Berliner Straße 957',
  plz: '51069',
  ort: 'Köln',
  land: 'Deutschland',
  telefon: '+49 221 95490625',
  email: 'service@reinigungsdienstcleanconnect.de',
  web: 'www.cleanconnect.de',
  amtsgericht: 'Amtsgericht Köln',
  hrNummer: 'HRB 119725',
  ustId: 'DE369309039',
  steuerNr: '218/5706/1994',
  geschaeftsfuehrung: 'Fynn Laubkermeier',
  bankinstitut: 'Sparkasse KölnBonn',
  iban: 'DE79 3705 0198 1901 2115 06',
  bic: 'COLSDE33XXX',
};

// Feste Vertragsstandards aus dem Referenzvertrag - im Formular bewusst nicht
// pro Vertrag änderbar, damit sie nicht versehentlich verwässert werden.
export const VERSICHERUNGSSUMME_EUR = 1_000_000;
export const VERTRAGSSTRAFE_EUR = 2500;
export const HAFTUNG_SCHLUESSEL_EINFACH_EUR = 50;
export const HAFTUNG_SCHLIESSANLAGE_EUR = 2500;
export const RUEGEFRIST_WERKTAGE = 10;
export const RUEGEFRIST_VERBRAUCHER_WERKTAGE = 14;
export const NACHERFUELLUNG_WERKTAGE = 5;
export const VERZUGSZINSSATZ_PUNKTE = 9;
export const ZAHLUNGSZIEL_WERKTAGE = 10;

export const STANDARD_MWST = 19;

// Stempel, der bei jeder Vertragserstellung mit in renderedData gespeichert
// wird - rein zur Nachvollziehbarkeit, falls die feste §1-§9-Vorlage
// (contractDocx.js) je geändert wird. Bei einer inhaltlichen Änderung der
// Vorlage hier hochzählen.
export const CONTRACT_TEMPLATE_VERSION = 'contract-v2-2026-07-29';

// Bewusst nur zwei Kategorien, keine feinere Branchenausdifferenzierung -
// deckt sich mit der tatsächlichen Kundenstruktur (überwiegend Büro/
// Treppenhaus, gelegentlich Arzt-/Physio-/Psychologenpraxen). Mehr
// Varianten würden die Wahrscheinlichkeit einer Fehlauswahl erhöhen, ohne
// echten Nutzen für nicht vorkommende Fälle (Kanzlei, Kindergarten o.ä.) -
// bewusst entfernt (Rückfrage 2026-07-29 beantwortet).
export const BRANCHEN = [
  { key: 'buero', label: 'Büro' },
  { key: 'treppenhaus', label: 'Treppenhaus / Wohnanlage' },
  { key: 'gewerbehalle', label: 'Gewerbehalle / Produktion' },
  { key: 'praxis', label: 'Arzt-/Physio-/Psychologenpraxis' },
  { key: 'sonstiges', label: 'Sonstiges' },
];

// Jede Branche bekommt eine passende DSGVO-Zusatzklausel-Variante für § 7.2,
// verallgemeinert aus der Arztpraxis-Formulierung im Referenzvertrag.
export const DSGVO_VARIANTEN = {
  standard: {
    label: 'Standard (Büro, Treppenhaus, Gewerbe)',
    braucht_avv: false,
    // Begründung braucht_avv: false - bei reiner Unterhaltsreinigung ohne
    // gezielten, planmäßigen Datenzugriff gelten Reinigungskräfte nach
    // gängiger Aufsichtsbehördenpraxis (u.a. LfDI-FAQs zur Gebäudereinigung)
    // nicht als Auftragsverarbeiter i.S.v. Art. 28 DSGVO, solange die
    // Kenntnisnahme rein zufällig bleibt. Das wird unten im Vertragstext
    // selbst begründet, nicht nur stillschweigend angenommen.
    text: `Bei der Reinigung von Büroflächen, Treppenhäusern und sonstigen Gemeinschaftsflächen
erlangt der Auftragnehmer allenfalls zufällig Kenntnis von personenbezogenen Daten (z.B.
Namen auf Schreibtischunterlagen, Bildschirminhalten, Besucherlisten, Namens- und
Klingelschildern, Briefkästen oder Postsendungen). Eine gezielte, planmäßige Verarbeitung
personenbezogener Daten im Auftrag des Auftraggebers ist nicht Gegenstand dieses Vertrages;
der Auftragnehmer wird insoweit nicht als Auftragsverarbeiter im Sinne von Art. 28 DSGVO
tätig, sofern nicht ausnahmsweise eine gesonderte Vereinbarung zur Auftragsverarbeitung
geschlossen wird. Unabhängig davon trifft der Auftragnehmer angemessene technische und
organisatorische Maßnahmen gemäß Art. 32 DSGVO: Alle eingesetzten Mitarbeiter werden vor
Tätigkeitsbeginn schriftlich auf die Vertraulichkeit personenbezogener Daten verpflichtet
(sog. Datengeheimnis, Art. 29, Art. 32 Abs. 4 DSGVO) und ausdrücklich angewiesen, sichtbare
Unterlagen, Bildschirminhalte, Namens- und Klingelschilder, Briefkästen und Postsendungen
weder zu lesen noch zu kopieren, zu fotografieren, zu bewegen oder in sonstiger Weise zur
Kenntnis zu nehmen. Eine Weitergabe zufällig zur Kenntnis genommener Daten an Dritte erfolgt
nicht, soweit nicht gesetzlich vorgeschrieben. Stellt der Auftragnehmer bei seiner Tätigkeit
Anhaltspunkte für eine Verletzung des Schutzes personenbezogener Daten fest (z.B. offensichtlich
unbefugten Zugriff Dritter auf Unterlagen oder IT-Systeme), informiert er den Auftraggeber
unverzüglich, spätestens innerhalb von 24 Stunden nach Kenntnisnahme, damit dieser seinen
Meldepflichten nach Art. 33 DSGVO nachkommen kann.`,
  },
  // Einzige Sonder-Variante, deckt Arzt-, Physiotherapie- und
  // Psychologenpraxen gemeinsam ab (statt einzelner Branchen-Varianten) -
  // rechtlich tragfähig, weil alle drei über Art. 9 DSGVO (Gesundheitsdaten)
  // abgedeckt sind, unabhängig davon, ob im Einzelfall zusätzlich eine
  // berufsständische Schweigepflicht (z.B. ärztlich) einschlägig ist.
  gesundheitsdaten: {
    label: 'Erhöhter Schutz — Arzt-/Physio-/Psychologenpraxis (Art. 9 DSGVO, AVV)',
    braucht_avv: true,
    text: `Da die Reinigung in einer Arzt-, Physiotherapie- oder Psychologenpraxis (oder einer
vergleichbaren Einrichtung mit Gesundheitsdaten) erfolgt und dabei zufällig Kenntnis von
Patienten- bzw. Klientendaten entstehen kann, verpflichtet sich der Auftragnehmer, alle
eingesetzten Mitarbeiter ausdrücklich auf das Datenschutzgeheimnis sowie - soweit im
Einzelfall einschlägig - die ärztliche bzw. berufliche Schweigepflicht zu verpflichten. Die
Mitarbeiter werden angewiesen, sichtbare Patienten- bzw. Behandlungsunterlagen nicht
einzusehen und Vertraulichkeit zu wahren. Da der Auftraggeber als Verantwortlicher im Sinne
der DSGVO gilt und der Auftragnehmer als Auftragsverarbeiter tätig wird, sind die Parteien
gemäß Art. 28 DSGVO verpflichtet, eine Vereinbarung zur Auftragsverarbeitung (AVV)
abzuschließen. Die als Anlage 3 beigefügte Vereinbarung zur Auftragsverarbeitung (AVV) ist
vor Beginn der Reinigungstätigkeit von beiden Parteien zu unterzeichnen und wird Bestandteil
dieses Vertrages.`,
  },
};

// Ordnet jeder Branche eine sinnvolle DSGVO-Standardvariante zu. Wird vom
// Formular (DbContractForm.jsx) genutzt, um bei Branchenauswahl automatisch
// die passende Klausel vorzubelegen (weiterhin manuell überschreibbar) -
// und von validateContract() (contractRules.js), um vor einer Fehlwahl
// (z.B. "Standard" für eine Praxis) zu warnen.
export const BRANCHE_ZU_DSGVO = {
  buero: 'standard',
  treppenhaus: 'standard',
  gewerbehalle: 'standard',
  praxis: 'gesundheitsdaten',
  sonstiges: 'standard',
};

// Angaben für den AVV-Baustein (avvDocx.js, Anlage 3) - nur für die eine
// DSGVO-Variante mit braucht_avv: true. Bewusst kurze, strukturierte Felder
// statt Fließtext - der Renderer baut daraus die Art.-28-Abs.-3-DSGVO-
// Pflichtangaben (Gegenstand/Art/Zweck/Kategorien).
export const AVV_VARIANTEN = {
  gesundheitsdaten: {
    kategorienBetroffenerPersonen:
      'Patientinnen und Patienten bzw. Klientinnen und Klienten des Auftraggebers sowie ggf. dessen Mitarbeiter',
    datenarten:
      'Gesundheitsdaten im Sinne von Art. 9 DSGVO (z.B. auf sichtbaren Unterlagen, Bildschirmen oder in ' +
      'Gesprächen zufällig wahrnehmbare Angaben zu Diagnosen, Behandlungen oder Terminen) sowie allgemeine ' +
      'personenbezogene Daten (Namen, Kontaktdaten)',
  },
};

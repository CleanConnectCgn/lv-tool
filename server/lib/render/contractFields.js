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
  // Gegen den echten, unterschriebenen Referenzvertrag VT-1265 (Briefkopf +
  // § 2.7) abgeglichen (2026-07-31) - die vorherige Adresse
  // (service@reinigungsdienstcleanconnect.de) war eine andere, nicht die im
  // aktuell genutzten Vertrag stehende Domain.
  email: 'service@cleanconnect.de',
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

// Feste Vertragsstandards - abgeglichen gegen den echten, unterschriebenen
// Referenzvertrag VT-1265 (Rafael Weiss, Anlage 3 + Hauptvertrag,
// 30.07.2026). Im Formular bewusst nicht pro Vertrag änderbar, damit sie
// nicht versehentlich verwässert werden.
export const VERSICHERUNGSSUMME_EUR = 1_000_000;
export const VERTRAGSSTRAFE_EUR = 2500;
// § 2.3/§ 5.2 im Referenzvertrag: EINE Schlüssel-/Schließanlagenversicherung
// mit einer Deckungssumme, nicht zwei getrennte Haftungshöchstbeträge - eine
// frühere Zwei-Stufen-Fassung (50 EUR einfacher Schlüssel / 2.500 EUR
// Schließanlage) wich hiervon ab und wurde beim Rechts-Audit gegen VT-1265
// verworfen (2026-07-30).
export const SCHLUESSEL_SCHLIESSANLAGE_VERSICHERUNG_EUR = 10_000;
// § 4.1/4.2 im Referenzvertrag: 14 Werktage, einheitlich (der Vertrag
// erklärt den Auftraggeber in § 1.4 ausdrücklich zum Unternehmer i.S.v.
// § 14 BGB - eine gesonderte, kürzere Verbraucher-Frist ist daher hier nicht
// vorgesehen).
export const RUEGEFRIST_WERKTAGE = 14;
export const NACHERFUELLUNG_WERKTAGE = 5;
// § 3.2 im Referenzvertrag nennt (Kalender-)Tage, nicht Werktage, und
// erwähnt Verzugszinsen an dieser Stelle nicht gesondert (§ 288 BGB gilt
// ohnehin gesetzlich) - Feldname bleibt ZAHLUNGSZIEL_WERKTAGE (bestehende
// API/DB-Feldbezeichnung), der gerenderte Text spricht aber von "Tagen".
export const ZAHLUNGSZIEL_WERKTAGE = 14;

export const STANDARD_MWST = 19;

// Stempel, der bei jeder Vertragserstellung mit in renderedData gespeichert
// wird - rein zur Nachvollziehbarkeit, falls die feste §1-§9-Vorlage
// (contractDocx.js) je geändert wird. Bei einer inhaltlichen Änderung der
// Vorlage hier hochzählen.
export const CONTRACT_TEMPLATE_VERSION = 'contract-v2-2026-07-29';

// Bewusst nur zwei Kategorien, keine feinere Branchenausdifferenzierung -
// deckt sich mit der tatsächlichen Kundenstruktur (überwiegend Büro/
// Treppenhaus, gelegentlich Arzt-/Physio-/Psychologenpraxen). Kanzlei/
// Kindergarten bleiben bewusst außen vor (Rückfrage 2026-07-29 beantwortet).
// Die drei Praxis-Typen wurden am 2026-07-31 wieder in eigene Branchen
// aufgesplittet (vorher eine gemeinsame "praxis"-Branche) - Rückfrage
// beantwortet: der echte Referenzvertrag VT-1265 benennt in § 7.2 konkret
// "Physiotherapiepraxis", eine verallgemeinerte Sammelformulierung wirkte
// beim tatsächlichen Kunden unpräzise/unpassend.
export const BRANCHEN = [
  { key: 'buero', label: 'Büro' },
  { key: 'treppenhaus', label: 'Treppenhaus / Wohnanlage' },
  { key: 'gewerbehalle', label: 'Gewerbehalle / Produktion' },
  { key: 'physiotherapiepraxis', label: 'Physiotherapiepraxis' },
  { key: 'arztpraxis', label: 'Arztpraxis' },
  { key: 'psychologenpraxis', label: 'Psychologen-/Psychotherapiepraxis' },
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
  // Wortlaut 1:1 aus dem echten, unterschriebenen Referenzvertrag VT-1265
  // (§ 7.2) übernommen - keine Verallgemeinerung mehr.
  physiotherapiepraxis: {
    label: 'Physiotherapiepraxis (Art. 9 DSGVO, AVV)',
    braucht_avv: true,
    text: `Da die Reinigung in einer Physiotherapiepraxis erfolgt und dabei zufällig Kenntnis von
Patientendaten entstehen kann, verpflichtet sich der Auftragnehmer, alle eingesetzten
Mitarbeiter ausdrücklich auf das Datenschutzgeheimnis und die Schweigepflicht zu
verpflichten. Die Mitarbeiter werden angewiesen, sichtbare Patientenunterlagen nicht
einzusehen und Vertraulichkeit zu wahren. Da der Auftraggeber als Verantwortlicher im Sinne
der DSGVO gilt und der Auftragnehmer als Auftragsverarbeiter tätig wird, sind die Parteien
gemäß Art. 28 DSGVO verpflichtet, eine Vereinbarung zur Auftragsverarbeitung (AVV)
abzuschließen. Die als Anlage 3 beigefügte Vereinbarung zur Auftragsverarbeitung (AVV) ist
vor Beginn der Reinigungstätigkeit von beiden Parteien zu unterzeichnen und wird Bestandteil
dieses Vertrages.`,
  },
  // Analog zur Physiotherapiepraxis-Variante abgeleitet (keine eigene
  // Referenz-Unterschrift vorhanden), ergänzt um die ärztliche
  // Schweigepflicht (§ 203 StGB), die für Arztpraxen einschlägig ist.
  arztpraxis: {
    label: 'Arztpraxis (Art. 9 DSGVO, AVV)',
    braucht_avv: true,
    text: `Da die Reinigung in einer Arztpraxis erfolgt und dabei zufällig Kenntnis von
Patientendaten entstehen kann, verpflichtet sich der Auftragnehmer, alle eingesetzten
Mitarbeiter ausdrücklich auf das Datenschutzgeheimnis sowie die ärztliche Schweigepflicht
(§ 203 StGB) zu verpflichten. Die Mitarbeiter werden angewiesen, sichtbare
Patientenunterlagen nicht einzusehen und Vertraulichkeit zu wahren. Da der Auftraggeber als
Verantwortlicher im Sinne der DSGVO gilt und der Auftragnehmer als Auftragsverarbeiter tätig
wird, sind die Parteien gemäß Art. 28 DSGVO verpflichtet, eine Vereinbarung zur
Auftragsverarbeitung (AVV) abzuschließen. Die als Anlage 3 beigefügte Vereinbarung zur
Auftragsverarbeitung (AVV) ist vor Beginn der Reinigungstätigkeit von beiden Parteien zu
unterzeichnen und wird Bestandteil dieses Vertrages.`,
  },
  // Analog abgeleitet, ergänzt um die psychotherapeutische Schweigepflicht
  // (§ 203 StGB) und "Klienten" statt "Patienten" als übliche Bezeichnung.
  psychologenpraxis: {
    label: 'Psychologen-/Psychotherapiepraxis (Art. 9 DSGVO, AVV)',
    braucht_avv: true,
    text: `Da die Reinigung in einer Psychologen- bzw. Psychotherapiepraxis erfolgt und dabei
zufällig Kenntnis von Klientendaten entstehen kann, verpflichtet sich der Auftragnehmer, alle
eingesetzten Mitarbeiter ausdrücklich auf das Datenschutzgeheimnis sowie die
psychotherapeutische Schweigepflicht (§ 203 StGB) zu verpflichten. Die Mitarbeiter werden
angewiesen, sichtbare Klientenunterlagen nicht einzusehen und Vertraulichkeit zu wahren. Da
der Auftraggeber als Verantwortlicher im Sinne der DSGVO gilt und der Auftragnehmer als
Auftragsverarbeiter tätig wird, sind die Parteien gemäß Art. 28 DSGVO verpflichtet, eine
Vereinbarung zur Auftragsverarbeitung (AVV) abzuschließen. Die als Anlage 3 beigefügte
Vereinbarung zur Auftragsverarbeitung (AVV) ist vor Beginn der Reinigungstätigkeit von beiden
Parteien zu unterzeichnen und wird Bestandteil dieses Vertrages.`,
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
  physiotherapiepraxis: 'physiotherapiepraxis',
  arztpraxis: 'arztpraxis',
  psychologenpraxis: 'psychologenpraxis',
  sonstiges: 'standard',
};

// Angaben für den AVV-Baustein (avvDocx.js, Anlage 3) - nur für die eine
// DSGVO-Variante mit braucht_avv: true. Bewusst kurze, strukturierte Felder
// statt Fließtext - der Renderer baut daraus die Art.-28-Abs.-3-DSGVO-
// Pflichtangaben (§ 2 Art der Daten/Kategorien betroffener Personen).
// datenartenListe/betroffenePersonen 1:1 gegen die echte, unterschriebene
// Referenz-AVV (Anlage3_AVV_Rafael_Weiss_VT-1265) abgeglichen (2026-07-30).
const PATIENTEN_DATENARTEN = [
  'Patientenstammdaten (Name, Anschrift, Kontaktdaten, Geburtsdatum)',
  'Gesundheitsdaten im Sinne des Art. 9 Abs. 1 DSGVO (z.B. Behandlungsunterlagen, Terminlisten, Befunde)',
  'Abrechnungs- und Vertragsdaten',
  'Beschäftigtendaten des Verantwortlichen (z.B. Dienstpläne)',
];
const PATIENTEN_BETROFFENE_PERSONEN =
  'Patientinnen und Patienten des Verantwortlichen, dessen Beschäftigte sowie Geschäftspartner und Besucher';

export const AVV_VARIANTEN = {
  physiotherapiepraxis: {
    betroffenePersonen: PATIENTEN_BETROFFENE_PERSONEN,
    datenartenListe: PATIENTEN_DATENARTEN,
  },
  arztpraxis: {
    betroffenePersonen: PATIENTEN_BETROFFENE_PERSONEN,
    datenartenListe: PATIENTEN_DATENARTEN,
  },
  // "Klienten" statt "Patienten" - üblichere Bezeichnung bei
  // Psychologen-/Psychotherapiepraxen.
  psychologenpraxis: {
    betroffenePersonen:
      'Klientinnen und Klienten des Verantwortlichen, dessen Beschäftigte sowie Geschäftspartner und Besucher',
    datenartenListe: [
      'Klientenstammdaten (Name, Anschrift, Kontaktdaten, Geburtsdatum)',
      'Gesundheitsdaten im Sinne des Art. 9 Abs. 1 DSGVO (z.B. Behandlungsunterlagen, Terminlisten, Befunde)',
      'Abrechnungs- und Vertragsdaten',
      'Beschäftigtendaten des Verantwortlichen (z.B. Dienstpläne)',
    ],
  },
};

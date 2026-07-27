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

export const BRANCHEN = [
  { key: 'buero', label: 'Büro' },
  { key: 'arztpraxis', label: 'Arztpraxis' },
  { key: 'kanzlei', label: 'Kanzlei' },
  { key: 'treppenhaus', label: 'Treppenhaus / Wohnanlage' },
  { key: 'gewerbehalle', label: 'Gewerbehalle / Produktion' },
  { key: 'kindergarten', label: 'Kindergarten / Schule' },
  { key: 'sonstiges', label: 'Sonstiges' },
];

// Jede Branche bekommt eine passende DSGVO-Zusatzklausel-Variante für § 7.2,
// verallgemeinert aus der Arztpraxis-Formulierung im Referenzvertrag.
export const DSGVO_VARIANTEN = {
  standard: {
    label: 'Standard (Büro/Gewerbe)',
    braucht_avv: false,
    text: `Der Auftragnehmer verpflichtet sich, im Rahmen der Leistungserbringung Kenntnis
erlangte personenbezogene Daten gemäß den Vorschriften der DSGVO und des BDSG
vertraulich zu behandeln und ausschließlich zur Vertragserfüllung zu verwenden. Eine
Weitergabe an Dritte erfolgt nicht, soweit nicht gesetzlich vorgeschrieben. Die
eingesetzten Reinigungskräfte werden auf das Datengeheimnis verpflichtet.`,
  },
  gesundheitsdaten: {
    label: 'Arztpraxis / Gesundheitsdaten (Art. 9 DSGVO)',
    braucht_avv: true,
    text: `Da die Reinigung in einer Arztpraxis erfolgt und dabei zufällig Kenntnis von
Patientendaten entstehen kann, verpflichtet sich der Auftragnehmer, alle eingesetzten
Mitarbeiter ausdrücklich auf das Datenschutzgeheimnis und die ärztliche
Schweigepflicht zu verpflichten. Die Mitarbeiter werden angewiesen, sichtbare
Patientenunterlagen nicht einzusehen und Vertraulichkeit zu wahren. Da der
Auftraggeber als Verantwortlicher im Sinne der DSGVO gilt und der Auftragnehmer als
Auftragsverarbeiter tätig wird, sind die Parteien gemäß Art. 28 DSGVO verpflichtet,
eine Vereinbarung zur Auftragsverarbeitung (AVV) abzuschließen. Die als Anlage 3
beigefügte Vereinbarung zur Auftragsverarbeitung (AVV) ist vor Beginn der
Reinigungstätigkeit von beiden Parteien zu unterzeichnen und wird Bestandteil dieses
Vertrages.`,
  },
  mandantendaten: {
    label: 'Kanzlei / Mandantendaten (§ 43a BRAO / § 57 StBerG)',
    braucht_avv: true,
    text: `Da die Reinigung in einer Kanzlei erfolgt und dabei zufällig Kenntnis von
Mandantendaten entstehen kann, verpflichtet sich der Auftragnehmer, alle eingesetzten
Mitarbeiter ausdrücklich auf das Datenschutzgeheimnis und die berufsrechtliche
Verschwiegenheitspflicht (§ 43a BRAO bzw. § 57 StBerG) zu verpflichten. Die
Mitarbeiter werden angewiesen, sichtbare Akten und Unterlagen nicht einzusehen, zu
bewegen oder zu fotografieren und Vertraulichkeit zu wahren. Da der Auftraggeber als
Verantwortlicher im Sinne der DSGVO gilt und der Auftragnehmer als
Auftragsverarbeiter tätig wird, sind die Parteien gemäß Art. 28 DSGVO verpflichtet,
eine Vereinbarung zur Auftragsverarbeitung (AVV) abzuschließen. Die als Anlage 3
beigefügte Vereinbarung zur Auftragsverarbeitung (AVV) ist vor Beginn der
Reinigungstätigkeit von beiden Parteien zu unterzeichnen und wird Bestandteil dieses
Vertrages.`,
  },
  minderjaehrige: {
    label: 'Kindergarten / Schule / Daten Minderjähriger (Art. 8 DSGVO)',
    braucht_avv: true,
    text: `Da die Reinigung in einer Einrichtung erfolgt, in der mit Kindern und deren
personenbezogenen Daten (u.a. gemäß Art. 8 DSGVO) gearbeitet wird, verpflichtet sich
der Auftragnehmer, ausschließlich Personal mit gültigem erweitertem
Führungszeugnis (§ 30a BZRG) einzusetzen und dieses ausdrücklich auf das
Datenschutzgeheimnis zu verpflichten. Die Mitarbeiter werden angewiesen, sichtbare
Unterlagen und Datenträger nicht einzusehen, zu bewegen oder zu fotografieren. Da
der Auftraggeber als Verantwortlicher im Sinne der DSGVO gilt und der Auftragnehmer
als Auftragsverarbeiter tätig wird, sind die Parteien gemäß Art. 28 DSGVO verpflichtet,
eine Vereinbarung zur Auftragsverarbeitung (AVV) abzuschließen. Die als Anlage 3
beigefügte Vereinbarung zur Auftragsverarbeitung (AVV) ist vor Beginn der
Reinigungstätigkeit von beiden Parteien zu unterzeichnen und wird Bestandteil dieses
Vertrages.`,
  },
};

// Ordnet jeder Branche eine sinnvolle DSGVO-Standardvariante zu (im Formular
// änderbar - der Checkup prüft später, ob Branche und Variante zusammenpassen).
export const BRANCHE_ZU_DSGVO = {
  buero: 'standard',
  arztpraxis: 'gesundheitsdaten',
  kanzlei: 'mandantendaten',
  treppenhaus: 'standard',
  gewerbehalle: 'standard',
  kindergarten: 'minderjaehrige',
  sonstiges: 'standard',
};

export function blankContract() {
  return {
    branche: 'buero',
    dsgvoVariante: 'standard',
    kunde: { firma: '', strasse: '', plz: '', ort: '', ansprechpartner: '', email: '' },
    // Interner Ansprechpartner auf Seite des Auftragnehmers für dieses
    // Vertragsprojekt (steht in der Kopfbox, nicht zu verwechseln mit der
    // Geschäftsführung, die unterzeichnet).
    internerAnsprechpartner: '',
    objektAdresse: '',
    datum: new Date().toISOString().slice(0, 10),
    vertragsbeginn: '',
    kuendigungsfristMonate: 2,
    reinigungsintervall: '',
    wochentage: [],
    verguetungNetto: '',
    mwstSatz: STANDARD_MWST,
    glasreinigung: { aktiv: false, preisNetto: '', intervall: 'auf Anfrage', ersteinsatzRabatt: true },
    angebotNummer: '',
    angebotDatum: '',
    lvDatum: '',
    vertragsnummer: '',
  };
}

// Fortlaufende Vertragsnummer im Format VT-XXXX. Rein client-seitig anhand
// des aktuellen Jahres + Zufallskomponente - für eine echte fortlaufende
// Nummerierung müsste ein Zähler serverseitig persistiert werden (siehe
// README "Noch offen").
export function generateVertragsnummer() {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `VT-${rand}`;
}

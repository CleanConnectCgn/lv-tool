// PDF-Fassung des Vertragsgenerators - eigenständiger Renderer (jsPDF,
// gleiche Optik wie server/lib/render/lvPdf.js), KEINE DOCX-zu-PDF-
// Konvertierung. Bewusste Entscheidung des Betreibers trotz des damit
// verbundenen Risikos: der Klauseltext lebt jetzt an ZWEI Stellen
// (server/lib/render/contractDocx.js und hier) statt an einer.
//
// WICHTIG FÜR KÜNFTIGE ÄNDERUNGEN: Jede inhaltliche Änderung an einer
// Vertragsklausel in contractDocx.js muss hier 1:1 nachgezogen werden
// (und umgekehrt) - es gibt keinen automatischen Abgleich. Die
// contractPdf.test.js prüft per pdftotext echten Text-Inhalt (nicht nur
// die PDF-Signatur wie lvPdf.test.js), das fängt grobe Abweichungen ab,
// ersetzt aber keinen manuellen Soll-Ist-Vergleich bei Textänderungen.
//
// Reine Formatierungsfunktionen (formatEuro/formatPercent/formatDateDE)
// werden direkt aus docxHelpers.js importiert statt dupliziert - die sind
// reine String-Logik ohne docx-Abhängigkeit, kein Duplizierungsrisiko.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  DSGVO_VARIANTEN,
  AUFTRAGNEHMER,
  STANDARD_MWST,
  VERSICHERUNGSSUMME_EUR,
  VERTRAGSSTRAFE_EUR,
  HAFTUNG_SCHLUESSEL_EINFACH_EUR,
  HAFTUNG_SCHLIESSANLAGE_EUR,
  RUEGEFRIST_WERKTAGE,
  RUEGEFRIST_VERBRAUCHER_WERKTAGE,
  NACHERFUELLUNG_WERKTAGE,
  VERZUGSZINSSATZ_PUNKTE,
  ZAHLUNGSZIEL_WERKTAGE as DEFAULT_ZAHLUNGSZIEL_WERKTAGE,
} from './contractFields.js';
import { validateContract } from './contractRules.js';
import { formatEuro, formatPercent, formatDateDE } from './docxHelpers.js';
import {
  TEAL,
  INK,
  GRAY,
  LINE,
  SEC_BG,
  PAGE_W,
  MARGIN_X,
  CONTENT_W,
  MARGIN_TOP,
  MARGIN_BOTTOM,
  headingRow,
  clauseRow,
  paraRow,
  bulletRow,
  boldRow,
  warnBannerRow,
  hinweisRow,
  drawLetterhead,
  drawFurniture,
  drawSignatureBlock,
  buildAutoTableBody,
} from './pdfHelpers.js';

function bruttoFromNetto(netto, mwstSatz) {
  if (netto === null || netto === undefined || netto === '') return null;
  const n = Number(netto);
  const satz = Number(mwstSatz);
  if (Number.isNaN(n) || Number.isNaN(satz)) return null;
  return n * (1 + satz / 100);
}

function kontodatenRows() {
  const line = (label, value) => [
    { content: `${label}: ${value}`, styles: { fontSize: 8.5, fillColor: SEC_BG, textColor: GRAY, cellPadding: { top: 1, bottom: 1, left: 4 } } },
  ];
  return [
    line('Kontoinhaber', AUFTRAGNEHMER.firma),
    line('Geldinstitut', AUFTRAGNEHMER.bankinstitut),
    line('IBAN', AUFTRAGNEHMER.iban),
    line('BIC', AUFTRAGNEHMER.bic),
    line('Verwendungszweck', 'Rechnungsnummer'),
  ];
}

// contract = { ... siehe contractDocx.js - identische Eingabeform ... }
export function buildContractPdf(contract) {
  const {
    kunde = {},
    objektAdresse,
    ueberschrift = 'Reinigungsvertrag',
    vertragsnummer,
    leistungsart = 'Unterhaltsreinigung',
    internerAnsprechpartner,
    datum,
    vertragsbeginn,
    laufzeitMonate,
    kuendigungsfristMonate,
    reinigungsintervall,
    verguetungNetto,
    mwstSatz,
    zahlungszielWerktage: zahlungszielWerktageRoh,
    optionalePositionen = [],
    dsgvoVariante,
    angebotNummer,
    angebotDatum,
    lvDatum,
    dsgvoKlausel,
  } = contract;

  const satz = mwstSatz ?? STANDARD_MWST;
  const zahlungszielWerktage = zahlungszielWerktageRoh ?? DEFAULT_ZAHLUNGSZIEL_WERKTAGE;
  const brutto = bruttoFromNetto(verguetungNetto, satz);
  const dsgvoInfo = dsgvoKlausel || DSGVO_VARIANTEN[dsgvoVariante] || DSGVO_VARIANTEN.standard;
  const { errors: vorgabenFehler, warnings: vorgabenHinweise } = validateContract(contract);
  const vorgabenMeldungen = [...vorgabenFehler, ...vorgabenHinweise];

  const kundeAdresse = [kunde.strasse, [kunde.plz, kunde.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  const body = [
    ...(vorgabenMeldungen.length > 0
      ? [warnBannerRow(`ENTWURF — vor Versand/Unterschrift ergänzen: ${vorgabenMeldungen.join('; ')}`)]
      : []),

    headingRow(1, 'Vertragsgegenstand'),
    clauseRow(
      '1.1',
      `Der Auftragnehmer, ${AUFTRAGNEHMER.firma}, verpflichtet sich, die im Leistungsverzeichnis beschriebenen ` +
        'Reinigungsleistungen für folgendes Objekt zu erbringen:'
    ),
    paraRow(`Objekt: ${objektAdresse || '[Objektadresse]'}`),
    clauseRow(
      '1.2',
      `Die konkreten Leistungen, Reinigungsintervalle und Leistungsflächen sind im beigefügten ` +
        `Leistungsverzeichnis (Anlage 1${lvDatum ? `, Stand: ${formatDateDE(lvDatum)}` : ''}) geregelt, das ` +
        `Bestandteil dieses Vertrages ist.` +
        (angebotNummer
          ? ` Das Angebot ${angebotNummer}${angebotDatum ? ` vom ${formatDateDE(angebotDatum)}` : ''} ist als ` +
            `Anlage 2 Bestandteil dieses Vertrages. Die Vergütung optionaler Zusatzpositionen richtet sich nach ` +
            `§ 2 dieses Vertrages.`
          : '') +
        (dsgvoInfo.braucht_avv
          ? ' Die Vereinbarung zur Auftragsverarbeitung (AVV) ist als Anlage 3 Bestandteil dieses Vertrages.'
          : '')
    ),
    clauseRow(
      '1.3',
      'Dieser Vertrag wird als Werkvertrag im Sinne der §§ 631 ff. BGB geschlossen. Der Auftragnehmer schuldet ' +
        'den vereinbarten Reinigungserfolg, nicht lediglich das Tätigwerden.'
    ),

    headingRow(2, 'Leistungsumfang und Pflichten'),
    boldRow(`Leistung 1: ${leistungsart}`),
    bulletRow(`Reinigungsintervall: ${reinigungsintervall || '[Intervall]'}`),
    bulletRow(`Objekt: ${objektAdresse || '[Objektadresse]'}`),
    bulletRow(`Gemäß beigefügtem Leistungsverzeichnis${lvDatum ? ` (Stand: ${formatDateDE(lvDatum)})` : ''}`),
    bulletRow('Reinigung außerhalb der regulären Öffnungszeiten, sofern nicht anders vereinbart'),

    ...optionalePositionen.flatMap((pos, i) => {
      const posBrutto = bruttoFromNetto(pos.preisNetto, satz);
      const ersteinsatzNetto = pos.ersteinsatzRabatt ? Number(pos.preisNetto || 0) / 2 : null;
      return [
        boldRow(`Leistung ${i + 2}: ${pos.name} (Pauschalpreis pro Einsatz)`),
        bulletRow(`Reinigungsintervall: ${pos.intervall || 'auf Anfrage'}`),
        bulletRow(`Objekt: ${objektAdresse || '[Objektadresse]'}`),
        bulletRow(
          `Vergütung: ${formatEuro(pos.preisNetto)} netto zzgl. ${formatPercent(satz)} % MwSt. (${formatEuro(posBrutto)} brutto) je Einsatz`
        ),
        ...(pos.ersteinsatzRabatt
          ? [
              bulletRow(
                `Erster Einsatz nach Auftragserteilung: 50 % Rabatt (${formatEuro(ersteinsatzNetto)} statt ${formatEuro(pos.preisNetto)})`
              ),
            ]
          : []),
      ];
    }),

    clauseRow(
      '2.3',
      'Der Auftraggeber stellt die erforderlichen Zugangsmittel (z.B. Schlüssel, Transponder) unentgeltlich zur ' +
        'Verfügung. Ein Verlust ist dem Auftraggeber unverzüglich zu melden. Der Auftragnehmer haftet für den ' +
        'Verlust oder die Beschädigung von Zugangsmitteln nur, soweit ihn oder seine Erfüllungsgehilfen hierbei ' +
        'Vorsatz oder grobe Fahrlässigkeit trifft. Im Falle einfacher Fahrlässigkeit haftet der Auftragnehmer ' +
        `beschränkt auf den reinen Wiederbeschaffungswert des einzelnen Schlüssels oder Transponders (max. ` +
        `${formatEuro(HAFTUNG_SCHLUESSEL_EINFACH_EUR)}). Eine darüber hinausgehende Haftung für die Änderung der ` +
        'gesamten Schließanlage ist ausgeschlossen, es sei denn, der Verlust wurde grob fahrlässig verursacht ' +
        'oder eine Schließanlagenänderung ist - unabhängig vom Verschuldensgrad - zur Abwehr eines konkreten ' +
        'Sicherheitsrisikos erforderlich; in diesem Fall haftet der Auftragnehmer für die Kosten einer Teil- ' +
        `oder Komplettänderung der Schließanlage, begrenzt auf ${formatEuro(HAFTUNG_SCHLIESSANLAGE_EUR)} je ` +
        'Schadensfall. Bei Vertragsende sind sämtliche Zugangsmittel spätestens am letzten Werktag der ' +
        'Vertragslaufzeit zurückzugeben.'
    ),
    clauseRow(
      '2.4',
      'Der Auftragnehmer ist verpflichtet, Personalausfälle (z.B. Krankheit, Urlaub) durch geeignete ' +
        'organisatorische Maßnahmen zu kompensieren. Kann ein vereinbarter Reinigungstermin aus unverschuldetem ' +
        'Personalmangel ausnahmsweise nicht erbracht werden, ist der Auftraggeber unverzüglich zu informieren ' +
        'und ein Nachholtermin innerhalb von zwei Werktagen zu vereinbaren.'
    ),
    clauseRow(
      '2.5',
      'Die zu reinigenden Räumlichkeiten müssen dem Auftragnehmer zu den vereinbarten Reinigungszeiten ' +
        'zugänglich sein bzw. gemacht werden.'
    ),
    clauseRow(
      '2.6',
      'Der Auftragnehmer ist berechtigt, zur Erfüllung seiner Leistungspflichten geeignete Subunternehmer ' +
        'einzusetzen. Er bleibt gegenüber dem Auftraggeber in vollem Umfang für die ordnungsgemäße ' +
        'Leistungserbringung verantwortlich. Eingesetzte Subunternehmer sind auf die vertraglichen Pflichten, ' +
        'insbesondere hinsichtlich Qualität, Vertraulichkeit und Datenschutz, zu verpflichten.'
    ),
    clauseRow(
      '2.7',
      `Ansprechpartner des Auftragnehmers ist ${AUFTRAGNEHMER.geschaeftsfuehrung} (Geschäftsführer), erreichbar ` +
        `unter ${AUFTRAGNEHMER.telefon} sowie ${AUFTRAGNEHMER.email}. Bei Mängeln, Notfällen oder ` +
        'organisatorischen Rückfragen ist dieser Kontakt zu nutzen. Änderungen werden dem Auftraggeber in ' +
        'Textform mitgeteilt.'
    ),

    headingRow(3, 'Vergütung und Zahlungsbedingungen'),
    clauseRow(
      '3.1',
      `Der Auftragnehmer erhält vom Auftraggeber ein monatliches Pauschalhonorar für die ${leistungsart} in ` +
        `Höhe von ${formatEuro(verguetungNetto)} netto zzgl. ${formatPercent(satz)} % MwSt., entspricht ` +
        `${formatEuro(brutto)} brutto.` +
        (optionalePositionen.length > 0
          ? ' Die optionalen Zusatzpositionen werden gemäß den Angaben in § 2 je Einsatz vergütet.'
          : '')
    ),
    clauseRow(
      '3.2',
      `Der Auftragnehmer stellt dem Auftraggeber monatlich eine ordnungsgemäße Rechnung. Die Übermittlung ` +
        `erfolgt in Textform, vorzugsweise per E-Mail. Die Vergütung wird mit Zugang der Rechnung angefordert ` +
        `und ist innerhalb von ${zahlungszielWerktage} Werktagen zu leisten. Bei Zahlungsverzug sind ` +
        `Verzugszinsen in Höhe von ${VERZUGSZINSSATZ_PUNKTE} Prozentpunkten über dem Basiszinssatz gemäß § 288 ` +
        'Abs. 2 BGB geschuldet.'
    ),
    ...kontodatenRows(),
    clauseRow('3.3', 'Für die ordnungsgemäße Versteuerung der Vergütung ist der Auftragnehmer selbst verantwortlich.'),
    clauseRow(
      '3.4',
      'Der Auftraggeber ist berechtigt, mit unbestrittenen oder rechtskräftig festgestellten Gegenforderungen ' +
        'aufzurechnen. Bei begründeten und dokumentierten Mängeln ist der Auftraggeber berechtigt, ein ' +
        'Zurückbehaltungsrecht in Höhe des zweifachen Mangelbeseitigungsaufwandes auszuüben, bis der Mangel ' +
        'behoben ist.'
    ),
    clauseRow(
      '3.5',
      'Weicht der tatsächliche Verschmutzungsgrad einmalig und außerordentlich vom vereinbarten Niveau ab, ist ' +
        'der Auftragnehmer zur Mehrleistung ohne zusätzliche Vergütung verpflichtet, sofern der Mehraufwand pro ' +
        'Einsatz 30 Minuten nicht übersteigt. Bei Uneinigkeit über das Ausmaß des Verschmutzungsgrades ' +
        'dokumentieren beide Parteien den Zustand gemeinsam per Foto oder Protokoll vor Beginn der Reinigung. ' +
        'Bei dauerhaft erhöhtem Verschmutzungsgrad oder einem Mehraufwand von mehr als 30 Minuten pro Einsatz ' +
        'ist der Auftragnehmer berechtigt, eine schriftliche Vergütungsanpassung zu verlangen. Nicht im ' +
        'Leistungsverzeichnis aufgeführte Arbeiten werden gegen gesonderte, vorher in Textform zu vereinbarende ' +
        'Vergütung ausgeführt.'
    ),
    clauseRow(
      '3.6',
      'Ändert sich der Tariflohn im Gebäudereinigerhandwerk (Lohngruppe 1 für Unterhaltsreinigung, Lohngruppe ' +
        '6 für Glasreinigung) um mehr als 3 %, kann jede Partei eine entsprechende Anpassung in Textform ' +
        'verlangen. Erhöhungen und Senkungen werden gleichermaßen weitergegeben, maximal 5 % pro Kalenderjahr, ' +
        'wirksam einen Monat nach Mitteilung. Bei Erhöhungen über 5 % hat jede Partei ein Sonderkündigungsrecht ' +
        'mit einer Frist von einem Monat zum Monatsende.'
    ),
    clauseRow(
      '3.7',
      'Der Auftraggeber verpflichtet sich, den Auftragnehmer unverzüglich in Textform zu informieren, sofern ' +
        'bei ihm die Voraussetzungen für eine Umkehr der Steuerschuldnerschaft nach § 13b Abs. 2 Nr. 8 UStG ' +
        'vorliegen. In diesem Fall wird die Vergütung ohne Umsatzsteuerausweis in Rechnung gestellt. Unterlässt ' +
        'der Auftraggeber diese Mitteilung, haftet er für etwaige steuerliche Nachteile des Auftragnehmers.'
    ),

    headingRow(4, 'Abnahme, Mängelanzeige und Gewährleistung'),
    clauseRow(
      '4.1',
      'Da dieser Vertrag als Dauerwerkvertrag auf monatlich abzunehmende Reinigungsleistungen gerichtet ist, ist ' +
        'der Auftragnehmer berechtigt, dem Auftraggeber mit jeder Monatsrechnung eine Abnahmeaufforderung ' +
        'gemäß § 640 Abs. 2 BGB zu erteilen. Der Auftraggeber wird darauf hingewiesen, dass die im jeweiligen ' +
        `Monat erbrachten Reinigungsleistungen als abgenommen gelten, sofern er nicht innerhalb von ` +
        `${RUEGEFRIST_WERKTAGE} Werktagen (bei Verbrauchern: ${RUEGEFRIST_VERBRAUCHER_WERKTAGE} Werktagen) nach ` +
        'Zugang der Rechnung in Textform einen oder mehrere Mängel rügt. Die Rüge muss den Mangel hinreichend ' +
        'konkret beschreiben (Art und Ort); eine Sammelrüge mehrerer Mängel ist zulässig. Das Zahlungsziel ' +
        'richtet sich nach § 3.2.'
    ),
    clauseRow(
      '4.2',
      'Bei verdeckten Mängeln, die bei ordnungsgemäßer Untersuchung nicht erkennbar waren, beginnt die ' +
        'Rügefrist abweichend von 4.1 mit dem Zeitpunkt der Entdeckung; die Rüge muss unverzüglich, spätestens ' +
        `innerhalb von ${RUEGEFRIST_WERKTAGE} Werktagen nach Entdeckung (bei Verbrauchern: ` +
        `${RUEGEFRIST_VERBRAUCHER_WERKTAGE} Werktagen), in Textform unter Angabe von Zeit, Ort, Art und Umfang ` +
        'des Mangels erfolgen.'
    ),
    clauseRow(
      '4.3',
      'Im Falle einer mangelhaften Leistung hat der Auftraggeber dem Auftragnehmer in Textform eine Frist zur ' +
        `Nacherfüllung zu setzen, die mindestens ${NACHERFUELLUNG_WERKTAGE} Werktage betragen muss. Die ` +
        'Nacherfüllung hat spätestens beim nächsten regulären Reinigungseinsatz, jedoch nicht später als ' +
        `innerhalb von ${NACHERFUELLUNG_WERKTAGE} Werktagen nach Fristsetzung, zu erfolgen. Bei ` +
        'hygienerelevanten Mängeln (z.B. Sanitärbereiche, Behandlungs- oder Patientenbereiche) hat die ' +
        'Nacherfüllung spätestens am nächsten Werktag zu erfolgen. Unterbleibt die Nacherfüllung fristgerecht, ' +
        'ist der Auftraggeber berechtigt, die Mängel durch einen Dritten beseitigen zu lassen. Die hierfür ' +
        'anfallenden Kosten trägt der Auftragnehmer, jedoch nur bis zur Höhe der für eine vergleichbare ' +
        'Reinigungsleistung ortsüblichen Vergütung.'
    ),
    clauseRow(
      '4.4',
      'Kann der Mangel nicht beseitigt werden, kann der Auftraggeber eine angemessene Minderung der Vergütung ' +
        'verlangen oder den Vertrag kündigen.'
    ),
    clauseRow(
      '4.5',
      'Für Mängel, die darauf zurückzuführen sind, dass der Auftraggeber wichtige Informationen nicht ' +
        'mitgeteilt hat, wird keine Gewährleistung übernommen.'
    ),
    clauseRow(
      '4.6',
      'Mängelansprüche des Auftraggebers verjähren gemäß § 634a Abs. 1 Nr. 1 BGB in zwei Jahren ab der ' +
        'jeweiligen monatlichen Abnahme. Schadensersatzansprüche wegen arglistig verschwiegener Mängel ' +
        'verjähren nach der regelmäßigen Frist von drei Jahren gemäß §§ 195, 199 BGB. Die Verjährung von ' +
        'Mängelansprüchen wird durch eine Mängelrüge in Textform bis zur vollständigen Mängelbeseitigung ' +
        'gehemmt.'
    ),

    headingRow(5, 'Haftung und Versicherung'),
    clauseRow(
      '5.1',
      'Der Auftragnehmer haftet für Schäden, die er oder seine eingesetzten Mitarbeiter bei der ' +
        'Vertragsdurchführung am Eigentum des Auftraggebers oder Dritter verursachen. Bei Vorsatz und grober ' +
        'Fahrlässigkeit haftet der Auftragnehmer unbeschränkt. Bei leicht fahrlässiger Verletzung wesentlicher ' +
        'Vertragspflichten ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt. Bei ' +
        'leicht fahrlässiger Verletzung nicht vertragswesentlicher Nebenpflichten ist die Haftung ' +
        'ausgeschlossen.'
    ),
    clauseRow(
      '5.2',
      `Der Auftragnehmer verpflichtet sich, eine gültige Betriebshaftpflichtversicherung mit einer ` +
        `Deckungssumme von mindestens ${formatEuro(VERSICHERUNGSSUMME_EUR)} pauschal für Sach- und ` +
        'Vermögensschäden vorzuhalten. Der Nachweis ist dem Auftraggeber bei Vertragsschluss sowie auf ' +
        'jährliches Verlangen unverzüglich vorzulegen. Änderungen oder die Kündigung des ' +
        'Versicherungsvertrages sind dem Auftraggeber unverzüglich mitzuteilen.'
    ),
    clauseRow(
      '5.3',
      'Die Haftung für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit bleibt in jedem ' +
        'Fall unbeschränkt.'
    ),
    clauseRow(
      '5.4',
      'Der Auftragnehmer haftet für das Verschulden seiner Erfüllungsgehilfen gemäß § 278 BGB in gleichem ' +
        'Umfang wie für eigenes Verschulden. Zwingende gesetzliche Haftungstatbestände, insbesondere nach dem ' +
        'Produkthaftungsgesetz, bleiben von den vorstehenden Regelungen unberührt.'
    ),

    headingRow(6, 'Vertragsdauer und Kündigung'),
    clauseRow(
      '6.1',
      `Dieser Vertrag tritt am ${formatDateDE(vertragsbeginn)} in Kraft und wird ` +
        (laufzeitMonate
          ? `für die Dauer von ${laufzeitMonate} Monaten geschlossen. Wird der Vertrag nicht spätestens ` +
            `${kuendigungsfristMonate || '[X]'} Monate vor Ablauf der Laufzeit von einer Partei in Textform ` +
            'gekündigt, verlängert er sich automatisch um jeweils zwölf Monate.'
          : 'auf unbestimmte Zeit geschlossen.')
    ),
    clauseRow(
      '6.2',
      `Der Vertrag kann von jeder Partei mit einer Frist von ${kuendigungsfristMonate || '[X]'} Monaten zum ` +
        'Ende eines Kalendermonats' +
        (laufzeitMonate ? ' erstmals zum Ablauf der Laufzeit' : '') +
        ' in Textform gekündigt werden.'
    ),
    clauseRow(
      '6.3',
      'Das Recht zur fristlosen Kündigung aus wichtigem Grund bleibt unberührt. Ein wichtiger Grund liegt ' +
        'insbesondere vor bei: (a) einer schwerwiegenden Pflichtverletzung, die trotz Abmahnung in Textform ' +
        'nicht innerhalb von 10 Werktagen abgestellt wird; (b) Zahlungsverzug von mehr als 30 Tagen nach ' +
        'Mahnung in Textform; (c) Insolvenzantrag einer Vertragspartei; (d) einem Verstoß gegen Datenschutz- ' +
        'oder Vertraulichkeitspflichten; (e) wiederholten Mängeln trotz Nacherfüllung (mindestens drei ' +
        'dokumentierte Fälle innerhalb von zwei Monaten).'
    ),
    clauseRow(
      '6.4',
      'Bei einem Wechsel der Mehrheitsgesellschafter oder einer Betriebsveräußerung des Auftragnehmers hat der ' +
        'Auftraggeber ein Sonderkündigungsrecht mit einer Frist von einem Monat zum Monatsende.'
    ),
    clauseRow(
      '6.5',
      'Bei Vertragsende sind sämtliche Zugangsmittel und überlassenen Unterlagen unverzüglich, spätestens am ' +
        'letzten Werktag der Vertragslaufzeit, zurückzugeben.'
    ),

    headingRow(7, 'Datenschutz und Vertraulichkeit'),
    clauseRow(
      '7.1',
      'Der Auftragnehmer verpflichtet sich, sämtliche im Rahmen seiner Tätigkeit zugänglichen Informationen ' +
        'und Einblicke in Räumlichkeiten vertraulich zu behandeln. Diese Pflicht gilt für die Dauer von fünf ' +
        'Jahren nach Vertragsende fort.'
    ),
    clauseRow('7.2', dsgvoInfo.text.replace(/\s+/g, ' ').trim()),
    clauseRow(
      '7.3',
      'Der Auftragnehmer verarbeitet personenbezogene Daten ausschließlich zur Vertragserfüllung und im ' +
        'Einklang mit DSGVO und BDSG. Eine Weitergabe an Dritte erfolgt nicht.'
    ),
    clauseRow(
      '7.4',
      'Alle eingesetzten Mitarbeiter sind schriftlich auf Vertraulichkeits- und Datenschutzpflichten zu ' +
        'verpflichten; entsprechende Nachweise werden dem Auftraggeber unaufgefordert vor dem ersten Einsatz ' +
        'vorgelegt und danach auf Verlangen aktualisiert.'
    ),
    clauseRow(
      '7.5',
      'Bei einem schuldhaften Verstoß gegen die Vertraulichkeits- oder Datenschutzpflichten durch den ' +
        `Auftragnehmer oder seine Mitarbeiter verpflichtet sich der Auftragnehmer zur Zahlung einer ` +
        `Vertragsstrafe in Höhe von ${formatEuro(VERTRAGSSTRAFE_EUR)} pro Verstoß. Ein die Vertragsstrafe ` +
        'übersteigender, nachgewiesener Schaden kann zusätzlich geltend gemacht werden; die bereits gezahlte ' +
        'Vertragsstrafe wird auf einen solchen weitergehenden Schadensersatzanspruch angerechnet (§ 340 Abs. 2 ' +
        'BGB).'
    ),

    headingRow(8, 'Höhere Gewalt'),
    clauseRow(
      '8.1',
      'Keine der Vertragsparteien ist für die Nichterfüllung oder verzögerte Erfüllung ihrer Pflichten ' +
        'verantwortlich, soweit diese auf Ereignisse höherer Gewalt zurückzuführen sind, die außerhalb ihrer ' +
        'Einflusssphäre liegen (z.B. Naturkatastrophen, Pandemien, behördlich angeordnete Betriebsschließungen, ' +
        'Stromausfälle).'
    ),
    clauseRow(
      '8.2',
      'Die betroffene Partei informiert die andere Partei unverzüglich. Dauert das Ereignis länger als 30 Tage ' +
        'an, ist jede Partei berechtigt, den Vertrag mit sofortiger Wirkung zu kündigen.'
    ),

    headingRow(9, 'Schlussbestimmungen'),
    clauseRow(
      '9.1',
      'Mündliche Nebenabreden bestehen nicht. Änderungen und Ergänzungen dieses Vertrages bedürfen der ' +
        'Textform (E-Mail genügt).'
    ),
    clauseRow(
      '9.2',
      'Sollte eine Bestimmung dieses Vertrages unwirksam sein, bleibt der Vertrag im Übrigen wirksam. Die ' +
        'Parteien ersetzen die unwirksame Bestimmung durch eine wirksame Regelung, die dem wirtschaftlichen ' +
        'Zweck so weit wie möglich entspricht.'
    ),
    clauseRow(
      '9.3',
      'Bei Widersprüchen zwischen diesem Vertrag und den Anlagen gilt folgende Rangfolge: ' +
        [
          'dieser Vertrag',
          ...(dsgvoInfo.braucht_avv ? ['Vereinbarung zur Auftragsverarbeitung (Anlage 3)'] : []),
          'Leistungsverzeichnis (Anlage 1)',
          ...(angebotNummer ? ['Angebot (Anlage 2)'] : []),
        ]
          .map((text, i) => `(${i + 1}) ${text}`)
          .join(', ') +
        '.'
    ),
    clauseRow(
      '9.4',
      `Erfüllungsort ist ${AUFTRAGNEHMER.ort}. Ausschließlicher Gerichtsstand für alle Streitigkeiten aus ` +
        `diesem Vertrag ist, soweit gesetzlich zulässig, ${AUFTRAGNEHMER.ort}. Es gilt das Recht der ` +
        'Bundesrepublik Deutschland.'
    ),

    hinweisRow(
      'Hinweis: Diese Vorlage orientiert sich an einem bereits verwendeten Referenzvertrag, wurde aber für ' +
        'diesen Generator angepasst und automatisiert befüllt. Insbesondere branchenspezifische Klauseln ' +
        '(§ 7.2) und neu hinzugefügte Formulierungen sollten vor produktivem Einsatz in einem neuen ' +
        'Anwendungsfall anwaltlich geprüft werden.'
    ),
  ];

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  drawLetterhead(doc);
  const startY = drawHeaderBox(doc, {
    ueberschrift,
    kunde,
    kundeAdresse,
    vertragsnummer,
    datum,
    internerAnsprechpartner,
  });

  autoTable(doc, buildAutoTableBody(doc, { startY, body }));

  drawSignatureBlock(doc, kunde.firma);
  drawFurniture(doc);
  return Buffer.from(doc.output('arraybuffer'));
}

function drawHeaderBox(doc, { ueberschrift, kunde, kundeAdresse, vertragsnummer, datum, internerAnsprechpartner }) {
  const y0 = 24;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text(ueberschrift, MARGIN_X, y0 + 6);

  const boxY = y0 + 10;
  const boxH = 22;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.setFillColor(...SEC_BG);
  doc.rect(MARGIN_X, boxY, CONTENT_W, boxH, 'F');
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.8);
  doc.line(MARGIN_X, boxY, MARGIN_X, boxY + boxH);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...GRAY);
  doc.text('AN', MARGIN_X + 4, boxY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(kunde.firma || '[Auftraggeber]', MARGIN_X + 4, boxY + 9.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(kundeAdresse || '', MARGIN_X + 4, boxY + 14, { maxWidth: 90 });

  const rightX = PAGE_W - MARGIN_X - 4;
  const infoLine = (label, value, offsetY) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY);
    doc.text(label, rightX, boxY + offsetY, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(value || '—', rightX, boxY + offsetY + 4, { align: 'right' });
  };
  infoLine('VERTRAGSNUMMER', vertragsnummer, 5);
  infoLine('DATUM', formatDateDE(datum), 12);
  infoLine('ANSPRECHPARTNER', internerAnsprechpartner, 19);

  return boxY + boxH + 6;
}

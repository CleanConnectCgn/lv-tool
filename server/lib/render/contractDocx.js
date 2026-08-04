// Block 8: Vertragstext ist fester Code auf Basis von build_docs_v17
// (portiert aus dem separaten vertragsgenerator-Repo, siehe Auftrag D1 -
// "ein Deploy, ein Datenmodell"). Variabel sind AUSSCHLIESSLICH: Kunde,
// Objekt, Anschrift, Ueberschrift, Vertragsnummer, Leistungsart, Intervall,
// Preis, Zahlungsziel, Laufzeit, Kuendigungsfrist, Leistungsbeginn,
// Ansprechpartner, optionale Positionen. Haftung, Gewährleistung und
// Schlussbestimmungen sind unveränderlich - ihr Text ist wörtlich aus dem
// Referenzvertrag/build_docs_v17 übernommen, keine KI erzeugt hier
// irgendeinen Vertragstext.
//
// Gegenüber dem Original zwei Verallgemeinerungen (beide innerhalb der
// erlaubten variablen Felder):
// - "optionale Positionen" (Plural, Auftragstext) statt der alten, fest auf
//   "Glasreinigung" zugeschnittenen Sonderlogik - jetzt eine Liste beliebig
//   vieler Zusatzpositionen.
// - Zahlungsziel und Laufzeit sind jetzt echte Parameter (vorher feste
//   Konstante bzw. gar nicht abgebildet), mit den bisherigen Werten als
//   Standard, damit sich am Ergebnis für bestehende Fälle nichts ändert.
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import {
  DSGVO_VARIANTEN,
  AUFTRAGNEHMER,
  STANDARD_MWST,
  VERSICHERUNGSSUMME_EUR,
  VERTRAGSSTRAFE_EUR,
  SCHLUESSEL_SCHLIESSANLAGE_VERSICHERUNG_EUR,
  RUEGEFRIST_WERKTAGE,
  NACHERFUELLUNG_WERKTAGE,
  ZAHLUNGSZIEL_WERKTAGE as DEFAULT_ZAHLUNGSZIEL_WERKTAGE,
} from './contractFields.js';
import { validateContract } from './contractRules.js';
import {
  TEAL,
  GRAY,
  heading,
  para,
  clause,
  bullet,
  formatEuro,
  formatPercent,
  formatDateDE,
  noBorders,
  infoBoxRow,
  letterhead,
  footerNote,
  signatureBlock,
} from './docxHelpers.js';

function bruttoFromNetto(netto, mwstSatz) {
  // Number(null) und Number('') sind 0, nicht NaN - ohne diese explizite
  // Prüfung hätte eine fehlende Vergütung hier bereits zu 0 EUR brutto
  // "verrechnet" und wäre nie als fehlend bei formatEuro() angekommen
  // (siehe docxHelpers.js).
  if (netto === null || netto === undefined || netto === '') return null;
  const n = Number(netto);
  const satz = Number(mwstSatz);
  if (Number.isNaN(n) || Number.isNaN(satz)) return null;
  return n * (1 + satz / 100);
}

function kontodatenTable() {
  const row = (label, value, bold) =>
    new TableRow({
      children: [
        new TableCell({
          width: { size: 35, type: WidthType.PERCENTAGE },
          shading: { fill: 'F5F8F8' },
          children: [new Paragraph({ children: [new TextRun({ text: label, color: GRAY, size: 18 })] })],
        }),
        new TableCell({
          width: { size: 65, type: WidthType.PERCENTAGE },
          shading: { fill: 'F5F8F8' },
          children: [new Paragraph({ children: [new TextRun({ text: value, bold: !!bold, size: 18 })] })],
        }),
      ],
    });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      row('Kontoinhaber', AUFTRAGNEHMER.firma),
      row('Geldinstitut', AUFTRAGNEHMER.bankinstitut),
      row('IBAN', AUFTRAGNEHMER.iban, true),
      row('BIC', AUFTRAGNEHMER.bic),
      row('Verwendungszweck', 'Rechnungsnummer'),
    ],
  });
}

// contract = {
//   kunde: { firma, strasse, plz, ort, ansprechpartner },      // Kunde, Anschrift
//   objektAdresse,                                             // Objekt
//   ueberschrift,                                              // Ueberschrift (Standard: "Reinigungsvertrag")
//   vertragsnummer,                                            // Vertragsnummer
//   leistungsart,                                              // Leistungsart (Standard: "Unterhaltsreinigung")
//   reinigungsintervall,                                       // Intervall
//   verguetungNetto, mwstSatz,                                 // Preis
//   zahlungszielWerktage,                                      // Zahlungsziel (Standard: siehe contractFields.js)
//   laufzeitMonate,                                            // Laufzeit (leer = unbestimmte Zeit, wie bisher)
//   kuendigungsfristMonate,                                    // Kuendigungsfrist
//   vertragsbeginn,                                            // Leistungsbeginn
//   internerAnsprechpartner,                                   // Ansprechpartner (Auftragnehmer-seitig)
//   optionalePositionen: [{ name, intervall, preisNetto, ersteinsatzRabatt }], // optionale Positionen
//   dsgvoVariante, angebotNummer, angebotDatum, lvDatum, datum,
// }
export function buildContractDocument(contract) {
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
    // Bewusst kein Destructuring-Default (= DEFAULT_...): der greift nur bei
    // undefined, nicht bei explizitem null - genau das speichert die DB aber
    // (siehe documentRoutes.js), was zu "innerhalb von null Werktagen" führte
    // (gefunden 2026-07-29 beim Testen mit echten Daten). Stattdessen unten
    // per ?? aufgelöst, das behandelt null und undefined gleich.
    zahlungszielWerktage: zahlungszielWerktageRoh,
    optionalePositionen = [],
    dsgvoVariante,
    angebotNummer,
    angebotDatum,
    lvDatum,
    // Snapshot des tatsächlich verwendeten Klauseltexts, gesetzt beim Anlegen
    // (documentRoutes.js) - macht das Dokument unabhängig von späteren
    // Textänderungen an DSGVO_VARIANTEN (contractFields.js). Bestandsverträge
    // von vor dieser Änderung haben noch keinen Snapshot; für die greift der
    // Fallback auf die Live-Tabelle (deren historischer Text nicht mehr
    // rekonstruierbar ist, da er nie gespeichert wurde).
    dsgvoKlausel,
  } = contract;

  const satz = mwstSatz ?? STANDARD_MWST;
  const zahlungszielWerktage = zahlungszielWerktageRoh ?? DEFAULT_ZAHLUNGSZIEL_WERKTAGE;
  const brutto = bruttoFromNetto(verguetungNetto, satz);
  const dsgvoInfo = dsgvoKlausel || DSGVO_VARIANTEN[dsgvoVariante] || DSGVO_VARIANTEN.standard;
  const { errors: vorgabenFehler, warnings: vorgabenHinweise } = validateContract(contract);

  const kundeAdresse = [kunde.strasse, [kunde.plz, kunde.ort].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join('\n');

  const headerInfoRows = [
    infoBoxRow('Vertragsnummer', vertragsnummer),
    infoBoxRow('Datum', formatDateDE(datum)),
    infoBoxRow('Ansprechpartner', internerAnsprechpartner),
  ];
  if (kunde.ansprechpartner) {
    headerInfoRows.push(infoBoxRow('Ansprechpartner Kunde', kunde.ansprechpartner));
  }

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            borders: { ...noBorders(), left: { style: BorderStyle.SINGLE, size: 18, color: TEAL, space: 8 } },
            shading: { fill: 'F5F8F8' },
            margin: { top: 100, bottom: 100, left: 150, right: 100 },
            children: [
              new Paragraph({ children: [new TextRun({ text: 'AN', size: 16, color: GRAY })] }),
              new Paragraph({ children: [new TextRun({ text: kunde.firma || '[Auftraggeber]', bold: true })] }),
              ...kundeAdresse.split('\n').map((line) => new Paragraph(line)),
              new Paragraph(AUFTRAGNEHMER.land === 'Deutschland' ? 'Deutschland' : ''),
            ],
          }),
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            borders: noBorders(),
            margin: { top: 100, left: 200 },
            children: [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: headerInfoRows })],
          }),
        ],
      }),
    ],
  });

  const vorgabenMeldungen = [...vorgabenFehler, ...vorgabenHinweise];
  const warnBanner =
    vorgabenMeldungen.length > 0
      ? [
          new Paragraph({
            shading: { fill: 'FDECEC' },
            spacing: { before: 100, after: 200 },
            children: [
              new TextRun({
                text: `ENTWURF — vor Versand/Unterschrift ergänzen: ${vorgabenMeldungen.join('; ')}`,
                bold: true,
                color: 'B42318',
                size: 18,
              }),
            ],
          }),
        ]
      : [];

  const children = [
    ...letterhead(),
    ...warnBanner,
    new Paragraph({ children: [new TextRun({ text: ueberschrift, bold: true, size: 40 })], spacing: { after: 220 } }),
    headerTable,
    new Paragraph({ text: '', spacing: { after: 200 } }),

    heading('Vertragsgegenstand', 1),
    clause(
      '1.1',
      `Der Auftragnehmer, ${AUFTRAGNEHMER.firma}, verpflichtet sich, die im Leistungsverzeichnis ` +
        `beschriebenen Reinigungsleistungen für folgendes Objekt zu erbringen:`
    ),
    para(`Objekt: ${objektAdresse || '[Objektadresse]'}`),
    clause(
      '1.2',
      // Gegen den Referenzvertrag VT-1265 abgeglichen (2026-07-31): Angebot
      // referenziert und mit "gilt insbesondere für die Vergütung ..."
      // eingeleitet, AVV-Satz VOR dem Ausschluss-Satz, optionale
      // Angebotspositionen sind standardmäßig NICHT Vertragsbestandteil und
      // brauchen eine gesonderte schriftliche Beauftragung - nur wenn sie
      // tatsächlich in optionalePositionen aufgenommen wurden (§2), gelten
      // sie stattdessen als eingeschlossen und werden dort vergütet.
      `Die konkreten Leistungen, Reinigungsintervalle und Leistungsflächen sind im beigefügten ` +
        `Leistungsverzeichnis (Anlage 1${lvDatum ? `, Stand: ${formatDateDE(lvDatum)}` : ''}) geregelt, das ` +
        `Bestandteil dieses Vertrages ist.` +
        (angebotNummer
          ? ` Das Angebot ${angebotNummer}${angebotDatum ? ` vom ${formatDateDE(angebotDatum)}` : ''} ist als ` +
            `Anlage 2 Bestandteil dieses Vertrages und gilt insbesondere für die Vergütung der ` +
            `${leistungsart}sleistungen.`
          : '') +
        (dsgvoInfo.braucht_avv
          ? ' Die Vereinbarung zur Auftragsverarbeitung (AVV) ist als Anlage 3 Bestandteil dieses Vertrages.'
          : '') +
        (angebotNummer
          ? optionalePositionen.length > 0
            ? ' Die Vergütung der im Angebot als optional ausgewiesenen und in diesen Vertrag aufgenommenen ' +
              'Zusatzpositionen richtet sich nach § 2 dieses Vertrages.'
            : ' Die im Angebot als optional ausgewiesenen Positionen sind nicht Gegenstand dieses Vertrages ' +
              'und bedürfen einer gesonderten schriftlichen Beauftragung.'
          : '')
    ),
    clause(
      '1.3',
      'Dieser Vertrag wird als Werkvertrag im Sinne der §§ 631 ff. BGB geschlossen. Der Auftragnehmer ' +
        'schuldet den vereinbarten Reinigungserfolg, nicht lediglich das Tätigwerden.'
    ),
    // Fehlte bisher komplett (Rechts-Audit gegen Referenzvertrag VT-1265,
    // 2026-07-30) - trägt den Vertrag auf § 14 BGB (Unternehmer) fest, statt
    // die Verbraucherfrage offenzulassen.
    clause(
      '1.4',
      'Der Auftraggeber schließt diesen Vertrag in Ausübung seiner gewerblichen oder selbständigen ' +
        'beruflichen Tätigkeit und handelt damit als Unternehmer im Sinne des § 14 BGB. Die ' +
        'Reinigungsleistungen betreffen ausschließlich betrieblich genutzte Räumlichkeiten.'
    ),

    heading('Leistungsumfang und Pflichten', 2),
    // §2.1/§2.2 als Fließtext statt "Leistung 1: ..." + Bullet-Liste -
    // gegen den Referenzvertrag VT-1265 abgeglichen (2026-07-30): die
    // vorherige Bullet-Form existiert im echten Vertrag nicht.
    clause(
      '2.1',
      `Der Auftragnehmer erbringt die im beigefügten Leistungsverzeichnis (Anlage 1) beschriebenen ` +
        `Reinigungsleistungen. Das Regel-Reinigungsintervall beträgt ${reinigungsintervall || '[Intervall]'}. ` +
        'Abweichende Intervalle für einzelne Bereiche sind dem Leistungsverzeichnis zu entnehmen. Die ' +
        'Reinigung erfolgt außerhalb der regulären Öffnungszeiten des Auftraggebers, sofern nicht anders ' +
        'vereinbart.'
    ),
    clause(
      '2.2',
      'Die zu erbringenden Einzelleistungen, die betroffenen Bereiche sowie die jeweiligen ' +
        `Reinigungsintervalle ergeben sich abschließend aus dem Leistungsverzeichnis (Anlage 1)` +
        `${lvDatum ? `, Stand: ${formatDateDE(lvDatum)}` : ''}. Soweit dort für einzelne Leistungen oder ` +
        'Bereiche abweichende Intervalle ausgewiesen sind, gehen diese der pauschalen Intervallangabe in ' +
        '2.1 vor. Die Reinigung erfolgt außerhalb der regulären Öffnungszeiten des Auftraggebers, sofern ' +
        'nicht anders vereinbart.'
    ),

    // Optionale Positionen (Auftrag Block 8) - verallgemeinert statt fest auf
    // Glasreinigung zugeschnitten, jede Position bekommt einen eigenen
    // nummerierten Unterabschnitt.
    ...optionalePositionen.flatMap((pos, i) => {
      const posBrutto = bruttoFromNetto(pos.preisNetto, satz);
      const ersteinsatzNetto = pos.ersteinsatzRabatt ? Number(pos.preisNetto || 0) / 2 : null;
      return [
        new Paragraph({
          children: [new TextRun({ text: `Leistung ${i + 2}: ${pos.name} (Pauschalpreis pro Einsatz)`, bold: true })],
          spacing: { before: 140, after: 60 },
        }),
        bullet(`Reinigungsintervall: ${pos.intervall || 'auf Anfrage'}`),
        bullet(`Objekt: ${objektAdresse || '[Objektadresse]'}`),
        bullet(
          `Vergütung: ${formatEuro(pos.preisNetto)} netto zzgl. ${formatPercent(satz)} % MwSt. (${formatEuro(posBrutto)} brutto) je Einsatz`
        ),
        ...(pos.ersteinsatzRabatt
          ? [
              bullet(
                `Erster Einsatz nach Auftragserteilung: 50 % Rabatt (${formatEuro(ersteinsatzNetto)} statt ` +
                  `${formatEuro(pos.preisNetto)})`
              ),
            ]
          : []),
      ];
    }),

    clause(
      '2.3',
      'Der Auftraggeber stellt die erforderlichen Zugangsmittel (z.B. Schlüssel, Transponder) unentgeltlich ' +
        'zur Verfügung. Ein Verlust ist dem Auftraggeber unverzüglich zu melden. Der Auftragnehmer haftet für ' +
        'den Verlust oder die Beschädigung von Zugangsmitteln nur, soweit ihn oder seine Erfüllungsgehilfen ' +
        'hierbei Vorsatz oder grobe Fahrlässigkeit trifft. Im Falle einfacher Fahrlässigkeit haftet der ' +
        'Auftragnehmer für den Wiederbeschaffungswert des einzelnen Schlüssels oder Transponders. Ist infolge ' +
        'des Verlusts eine Teil- oder Komplettänderung der Schließanlage erforderlich, haftet der ' +
        `Auftragnehmer für die hierfür anfallenden Kosten bis zu einem Betrag von ` +
        `${formatEuro(SCHLUESSEL_SCHLIESSANLAGE_VERSICHERUNG_EUR)} je Schadensfall; der Auftragnehmer hält ` +
        'hierfür eine entsprechende Schlüssel- und Schließanlagenversicherung vor. Bei Vertragsende sind ' +
        'sämtliche Zugangsmittel spätestens am letzten Werktag der Vertragslaufzeit zurückzugeben.'
    ),
    clause(
      '2.4',
      'Der Auftragnehmer ist verpflichtet, Personalausfälle (z.B. Krankheit, Urlaub) durch geeignete ' +
        'organisatorische Maßnahmen zu kompensieren. Kann ein vereinbarter Reinigungstermin aus ' +
        'unverschuldetem Personalmangel ausnahmsweise nicht erbracht werden, ist der Auftraggeber ' +
        'unverzüglich zu informieren und ein Nachholtermin innerhalb von zwei Werktagen zu vereinbaren.'
    ),
    clause(
      '2.5',
      'Die zu reinigenden Räumlichkeiten müssen dem Auftragnehmer zu den vereinbarten Reinigungszeiten ' +
        'zugänglich sein bzw. gemacht werden.'
    ),
    clause(
      '2.6',
      'Der Auftragnehmer ist berechtigt, zur Erfüllung seiner Leistungspflichten geeignete Subunternehmer ' +
        'einzusetzen. Er bleibt gegenüber dem Auftraggeber in vollem Umfang für die ordnungsgemäße ' +
        'Leistungserbringung verantwortlich. Eingesetzte Subunternehmer sind auf die vertraglichen Pflichten, ' +
        'insbesondere hinsichtlich Qualität, Vertraulichkeit und Datenschutz, zu verpflichten.'
    ),
    clause(
      '2.7',
      `Ansprechpartner des Auftragnehmers ist ${AUFTRAGNEHMER.geschaeftsfuehrung} (Geschäftsführer), ` +
        `erreichbar unter ${AUFTRAGNEHMER.telefon} sowie ${AUFTRAGNEHMER.email}. Bei Mängeln, Notfällen oder ` +
        'organisatorischen Rückfragen ist dieser Kontakt zu nutzen. Änderungen werden dem Auftraggeber ' +
        'in Textform mitgeteilt.'
    ),

    heading('Vergütung und Zahlungsbedingungen', 3),
    clause(
      '3.1',
      `Der Auftragnehmer erhält vom Auftraggeber ein monatliches Pauschalhonorar für die ${leistungsart} ` +
        `in Höhe von ${formatEuro(verguetungNetto)} netto zzgl. ${formatPercent(satz)} % MwSt., entspricht ${formatEuro(brutto)} ` +
        `brutto. Mit dieser Vergütung sind sämtliche Reinigungsmaterialien, Reinigungsmittel, ` +
        'Verbrauchsmaterialien, die Wasseraufbereitung sowie die Anfahrt vollständig abgegolten. ' +
        'Hygieneverbrauchsmaterial (z.B. Seife, Papierhandtücher, Toilettenpapier) stellt der Auftraggeber, ' +
        'sofern nicht gesondert schriftlich vereinbart.' +
        (optionalePositionen.length > 0
          ? ' Die optionalen Zusatzpositionen werden gemäß den Angaben in § 2 je Einsatz vergütet.'
          : '')
    ),
    clause(
      '3.2',
      `Der Auftragnehmer stellt dem Auftraggeber monatlich eine ordnungsgemäße Rechnung. Die Übermittlung ` +
        `erfolgt in Textform, vorzugsweise per E-Mail. Die Vergütung wird mit Zugang der Rechnung angefordert ` +
        `und ist innerhalb von ${zahlungszielWerktage} Tagen zu leisten.`
    ),
    kontodatenTable(),
    new Paragraph({ text: '', spacing: { after: 140 } }),
    clause('3.3', 'Für die ordnungsgemäße Versteuerung der Vergütung ist der Auftragnehmer selbst verantwortlich.'),
    clause(
      // War "3.3a" - kein anderer Vertragsteil verweist auf diese oder die
      // folgenden Nummern (einzige Querverweis-Ausnahme im Vertrag ist § 3.2,
      // die unverändert bleibt), daher gefahrlos in die reguläre X.Y-Folge
      // umnummeriert. Gefunden beim Rechts-Audit 2026-07-30.
      '3.4',
      'Der Auftraggeber ist berechtigt, mit unbestrittenen oder rechtskräftig festgestellten Gegenforderungen ' +
        'aufzurechnen. Bei begründeten und dokumentierten Mängeln ist der Auftraggeber berechtigt, ein ' +
        'Zurückbehaltungsrecht in Höhe des zweifachen Mangelbeseitigungsaufwandes auszuüben, bis der Mangel ' +
        'behoben ist.'
    ),
    clause(
      '3.5',
      'Weicht der tatsächliche Verschmutzungsgrad einmalig und außerordentlich vom vereinbarten Niveau ab, ' +
        'ist der Auftragnehmer zur Mehrleistung ohne zusätzliche Vergütung verpflichtet, sofern der ' +
        'Mehraufwand pro Einsatz 30 Minuten nicht übersteigt. Bei Uneinigkeit über das Ausmaß des ' +
        'Verschmutzungsgrades dokumentieren beide Parteien den Zustand gemeinsam per Foto oder Protokoll vor ' +
        'Beginn der Reinigung. Bei dauerhaft erhöhtem Verschmutzungsgrad oder einem Mehraufwand von mehr als ' +
        '30 Minuten pro Einsatz ist der Auftragnehmer berechtigt, eine schriftliche Vergütungsanpassung zu ' +
        'verlangen. Nicht im Leistungsverzeichnis aufgeführte Arbeiten werden gegen gesonderte, vorher in ' +
        'Textform zu vereinbarende Vergütung ausgeführt.'
    ),
    clause(
      '3.6',
      'Ändert sich der Tariflohn im Gebäudereinigerhandwerk (Lohngruppe 1 für Unterhaltsreinigung) um mehr ' +
        // "in Textform" statt "schriftlich" - dieselbe §309-Nr.-13-BGB-Regel
        // wie bei §4.1/4.3 (siehe contractDocx.test.js): eine Erklärung des
        // Auftraggebers gegenüber dem Verwender darf in AGB keine strengere
        // Form als Textform verlangen. Rechts-Audit 2026-07-30.
        'als 2 %, kann jede Partei eine entsprechende Anpassung der Vergütung in Textform verlangen. ' +
        'Gleiches gilt bei einer erheblichen Änderung der gesetzlichen Sozialabgaben oder der Material- und ' +
        'Betriebskosten von mehr als 2 %. Erhöhungen und Senkungen werden gleichermaßen weitergegeben, ' +
        'maximal 7 % pro Kalenderjahr, wirksam einen Monat nach Mitteilung in Textform unter Angabe der ' +
        'maßgeblichen Kostenveränderung. Bei Erhöhungen über 5 % hat der Auftraggeber ein ' +
        'Sonderkündigungsrecht mit einer Frist von einem Monat zum Monatsende.'
    ),
    clause(
      '3.7',
      'Der Auftraggeber verpflichtet sich, den Auftragnehmer unverzüglich in Textform zu informieren, sofern ' +
        'bei ihm die Voraussetzungen für eine Umkehr der Steuerschuldnerschaft nach § 13b Abs. 2 Nr. 8 UStG ' +
        'vorliegen. In diesem Fall wird die Vergütung ohne Umsatzsteuerausweis in Rechnung gestellt. Unterlässt ' +
        'der Auftraggeber diese Mitteilung, haftet er für etwaige steuerliche Nachteile des Auftragnehmers.'
    ),

    heading('Abnahme, Mängelanzeige und Gewährleistung', 4),
    clause(
      '4.1',
      'Da dieser Vertrag als Dauerwerkvertrag auf monatlich abzunehmende Reinigungsleistungen gerichtet ist, ' +
        'ist der Auftragnehmer berechtigt, dem Auftraggeber mit jeder Monatsrechnung eine ' +
        'Abnahmeaufforderung gemäß § 640 Abs. 2 BGB zu erteilen. Der Auftraggeber wird darauf hingewiesen, ' +
        'dass die im jeweiligen Monat erbrachten Reinigungsleistungen als abgenommen gelten, sofern er nicht ' +
        `innerhalb von ${RUEGEFRIST_WERKTAGE} Werktagen nach Zugang der Rechnung in Textform einen oder ` +
        'mehrere Mängel rügt. Auf diese Frist und die Folgen ihres Verstreichens wird der Auftraggeber in ' +
        'jeder Abnahmeaufforderung ausdrücklich und in hervorgehobener Form hingewiesen. Die Rüge muss den ' +
        'Mangel hinreichend konkret beschreiben (Art und Ort); eine Sammelrüge mehrerer Mängel ist zulässig. ' +
        'Das Zahlungsziel richtet sich nach § 3.2.'
    ),
    clause(
      '4.2',
      'Bei verdeckten Mängeln, die bei ordnungsgemäßer Untersuchung nicht erkennbar waren, beginnt die ' +
        'Rügefrist abweichend von 4.1 mit dem Zeitpunkt der Entdeckung; die Rüge muss unverzüglich, spätestens ' +
        `innerhalb von ${RUEGEFRIST_WERKTAGE} Werktagen nach Entdeckung, in Textform unter Angabe von Zeit, ` +
        'Ort, Art und Umfang des Mangels erfolgen.'
    ),
    clause(
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
    clause(
      '4.4',
      'Kann der Mangel nicht beseitigt werden, kann der Auftraggeber eine angemessene Minderung der ' +
        'Vergütung verlangen oder den Vertrag kündigen.'
    ),
    clause(
      '4.5',
      'Für Mängel, die darauf zurückzuführen sind, dass der Auftraggeber wichtige Informationen nicht ' +
        'mitgeteilt hat, wird keine Gewährleistung übernommen.'
    ),
    clause(
      '4.6',
      'Mängelansprüche des Auftraggebers verjähren gemäß § 634a Abs. 1 Nr. 1 BGB in zwei Jahren ab der ' +
        'jeweiligen monatlichen Abnahme. Schadensersatzansprüche wegen arglistig verschwiegener Mängel ' +
        'verjähren nach der regelmäßigen Frist von drei Jahren gemäß §§ 195, 199 BGB. Die Verjährung von ' +
        'Mängelansprüchen wird durch eine Mängelrüge in Textform bis zur vollständigen Mängelbeseitigung ' +
        'gehemmt.'
    ),

    heading('Haftung und Versicherung', 5),
    clause(
      '5.1',
      'Der Auftragnehmer haftet für Schäden, die er oder seine eingesetzten Mitarbeiter bei der ' +
        'Vertragsdurchführung am Eigentum des Auftraggebers oder Dritter verursachen. Bei Vorsatz und grober ' +
        'Fahrlässigkeit haftet der Auftragnehmer unbeschränkt. Bei leicht fahrlässiger Verletzung von ' +
        'Vertragspflichten ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt, ' +
        `höchstens jedoch auf die zweifache Jahresvergütung nach § 3.1. Diese Haftungsbegrenzung gilt nicht ` +
        'für Schäden an Zugangsmitteln und Schließanlagen; hierfür gilt ausschließlich § 2.3.'
    ),
    clause(
      '5.2',
      `Der Auftragnehmer verpflichtet sich, eine gültige Betriebshaftpflichtversicherung mit einer ` +
        `Deckungssumme von mindestens ${formatEuro(VERSICHERUNGSSUMME_EUR)} pauschal für Sach- und ` +
        'Vermögensschäden vorzuhalten. Ergänzend hält der Auftragnehmer eine Schlüssel- und ' +
        `Schließanlagenversicherung mit einer Deckungssumme von mindestens ` +
        `${formatEuro(SCHLUESSEL_SCHLIESSANLAGE_VERSICHERUNG_EUR)} je Schadensfall vor. Die Nachweise sind ` +
        'dem Auftraggeber bei Vertragsschluss sowie auf jährliches Verlangen unverzüglich vorzulegen. ' +
        'Änderungen oder die Kündigung des Versicherungsvertrages sind dem Auftraggeber unverzüglich ' +
        'mitzuteilen.'
    ),
    clause(
      '5.3',
      'Die Haftung für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit bleibt in ' +
        'jedem Fall unbeschränkt.'
    ),
    clause(
      '5.4',
      'Der Auftragnehmer haftet für das Verschulden seiner Erfüllungsgehilfen gemäß § 278 BGB in gleichem ' +
        'Umfang wie für eigenes Verschulden. Zwingende gesetzliche Haftungstatbestände, insbesondere nach dem ' +
        'Produkthaftungsgesetz, bleiben von den vorstehenden Regelungen unberührt.'
    ),

    heading('Vertragsdauer und Kündigung', 6),
    clause(
      '6.1',
      `Dieser Vertrag tritt am ${formatDateDE(vertragsbeginn)} in Kraft und wird ` +
        (laufzeitMonate
          ? `für die Dauer von ${laufzeitMonate} Monaten geschlossen. Wird der Vertrag nicht spätestens ` +
            `${kuendigungsfristMonate || '[X]'} Monate vor Ablauf der Laufzeit von einer Partei in Textform ` +
            'gekündigt, verlängert er sich automatisch um jeweils zwölf Monate.'
          : 'auf unbestimmte Zeit geschlossen.')
    ),
    clause(
      '6.2',
      `Der Vertrag kann von jeder Partei mit einer Frist von ${kuendigungsfristMonate || '[X]'} Monaten zum ` +
        'Ende eines Kalendermonats' +
        (laufzeitMonate ? ' erstmals zum Ablauf der Laufzeit' : '') +
        ' in Textform gekündigt werden.'
    ),
    clause(
      '6.3',
      'Das Recht zur fristlosen Kündigung aus wichtigem Grund bleibt unberührt. Ein wichtiger Grund liegt ' +
        'insbesondere vor bei: (a) einer schwerwiegenden Pflichtverletzung, die trotz Abmahnung in Textform ' +
        'nicht innerhalb von 10 Werktagen abgestellt wird; (b) Zahlungsverzug von mehr als 30 Tagen nach ' +
        'Mahnung in Textform; (c) Insolvenzantrag einer Vertragspartei; (d) einem Verstoß gegen ' +
        'Datenschutz- oder Vertraulichkeitspflichten; (e) wiederholten Mängeln trotz Nacherfüllung ' +
        '(mindestens drei dokumentierte Fälle innerhalb von zwei Monaten).'
    ),
    clause(
      '6.4',
      'Bei einem Wechsel der Mehrheitsgesellschafter oder einer Betriebsveräußerung des Auftragnehmers hat ' +
        'der Auftraggeber ein Sonderkündigungsrecht mit einer Frist von einem Monat zum Monatsende.'
    ),
    clause(
      '6.5',
      'Bei Vertragsende sind sämtliche Zugangsmittel und überlassenen Unterlagen unverzüglich, spätestens ' +
        'am letzten Werktag der Vertragslaufzeit, zurückzugeben.'
    ),

    heading('Datenschutz und Vertraulichkeit', 7),
    clause(
      '7.1',
      'Der Auftragnehmer verpflichtet sich, sämtliche im Rahmen seiner Tätigkeit zugänglichen Informationen ' +
        'und Einblicke in Räumlichkeiten vertraulich zu behandeln. Diese Pflicht gilt für die Dauer von fünf ' +
        'Jahren nach Vertragsende fort.'
    ),
    clause('7.2', dsgvoInfo.text),
    clause(
      '7.3',
      'Der Auftragnehmer verarbeitet personenbezogene Daten ausschließlich zur Vertragserfüllung und im ' +
        'Einklang mit DSGVO und BDSG. Eine Weitergabe an Dritte erfolgt nicht.'
    ),
    clause(
      '7.4',
      'Alle eingesetzten Mitarbeiter sind schriftlich auf Vertraulichkeits- und Datenschutzpflichten zu ' +
        'verpflichten; entsprechende Nachweise werden dem Auftraggeber unaufgefordert vor dem ersten Einsatz ' +
        'vorgelegt und danach auf Verlangen aktualisiert.'
    ),
    clause(
      '7.5',
      'Bei einem schuldhaften Verstoß gegen die Vertraulichkeits- oder Datenschutzpflichten durch den ' +
        `Auftragnehmer oder seine Mitarbeiter verpflichtet sich der Auftragnehmer zur Zahlung einer ` +
        `Vertragsstrafe in Höhe von ${formatEuro(VERTRAGSSTRAFE_EUR)} pro Verstoß. Ein die Vertragsstrafe ` +
        'übersteigender, nachgewiesener Schaden kann zusätzlich geltend gemacht werden; die bereits gezahlte ' +
        'Vertragsstrafe wird auf einen solchen weitergehenden Schadensersatzanspruch angerechnet (§ 340 Abs. 2 ' +
        'BGB).'
    ),

    heading('Höhere Gewalt', 8),
    clause(
      '8.1',
      'Keine der Vertragsparteien ist für die Nichterfüllung oder verzögerte Erfüllung ihrer Pflichten ' +
        'verantwortlich, soweit diese auf Ereignisse höherer Gewalt zurückzuführen sind, die außerhalb ihrer ' +
        'Einflusssphäre liegen (z.B. Naturkatastrophen, Pandemien, behördlich angeordnete ' +
        'Betriebsschließungen, Stromausfälle).'
    ),
    clause(
      '8.2',
      'Die betroffene Partei informiert die andere Partei unverzüglich. Dauert das Ereignis länger als 30 ' +
        'Tage an, ist jede Partei berechtigt, den Vertrag mit sofortiger Wirkung zu kündigen.'
    ),

    heading('Schlussbestimmungen', 9),
    clause(
      '9.1',
      'Mündliche Nebenabreden bestehen nicht. Änderungen und Ergänzungen dieses Vertrages bedürfen der ' +
        'Textform (E-Mail genügt).'
    ),
    clause(
      '9.2',
      'Sollte eine Bestimmung dieses Vertrages unwirksam sein, bleibt der Vertrag im Übrigen wirksam. Die ' +
        'Parteien ersetzen die unwirksame Bestimmung durch eine wirksame Regelung, die dem wirtschaftlichen ' +
        'Zweck so weit wie möglich entspricht.'
    ),
    clause(
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
        '. Abweichend hiervon gehen die Angaben des Leistungsverzeichnisses (Anlage 1) vor, soweit sie Art, ' +
        'Umfang, Häufigkeit oder örtlichen Geltungsbereich der einzelnen Reinigungsleistungen betreffen.'
    ),
    clause(
      '9.4',
      `Erfüllungsort ist ${AUFTRAGNEHMER.ort}. Ausschließlicher Gerichtsstand für alle Streitigkeiten aus ` +
        `diesem Vertrag ist, soweit gesetzlich zulässig, ${AUFTRAGNEHMER.ort}. Es gilt das Recht der ` +
        'Bundesrepublik Deutschland.'
    ),

    new Paragraph({ text: '', spacing: { before: 200, after: 260 } }),
    signatureBlock(kunde.firma),

    new Paragraph({ text: '', spacing: { before: 260 } }),
    footerNote(),
  ];

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

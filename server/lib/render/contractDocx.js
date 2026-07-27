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
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from 'docx';
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

const TEAL = '00C5C4';
const GRAY = '6B7280';

function heading(text, num) {
  return new Paragraph({
    children: [new TextRun({ text: `§${num} ${text}`, bold: true, size: 24 })],
    spacing: { before: 260, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB', space: 4 } },
  });
}

function para(text) {
  return new Paragraph({ children: [new TextRun(text)], spacing: { after: 140 } });
}

function clause(num, text) {
  return new Paragraph({
    children: [new TextRun({ text: `${num} `, bold: true }), new TextRun(text)],
    spacing: { after: 120 },
  });
}

function bullet(text) {
  return new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 40 } });
}

function formatEuro(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  return `${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
}

function bruttoFromNetto(netto, mwstSatz) {
  const n = Number(netto);
  const satz = Number(mwstSatz);
  if (Number.isNaN(n) || Number.isNaN(satz)) return null;
  return n * (1 + satz / 100);
}

function formatDateDE(iso) {
  if (!iso) return '[Datum]';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

function noBorders() {
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  return { top: none, bottom: none, left: none, right: none };
}

function infoBoxRow(label, value) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 45, type: WidthType.PERCENTAGE },
        borders: noBorders(),
        children: [new Paragraph({ children: [new TextRun({ text: label, color: GRAY, size: 18 })] })],
      }),
      new TableCell({
        width: { size: 55, type: WidthType.PERCENTAGE },
        borders: noBorders(),
        children: [new Paragraph({ children: [new TextRun({ text: value || '—', bold: true, size: 18 })] })],
      }),
    ],
  });
}

function letterhead() {
  return [
    new Paragraph({
      children: [
        new TextRun({ text: AUFTRAGNEHMER.firma.toUpperCase(), bold: true, size: 18 }),
        new TextRun({
          text: `\n${AUFTRAGNEHMER.strasse} | ${AUFTRAGNEHMER.plz} ${AUFTRAGNEHMER.ort} | ${AUFTRAGNEHMER.telefon} | ${AUFTRAGNEHMER.email}`,
          size: 16,
          color: GRAY,
        }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: TEAL, space: 6 } },
      spacing: { after: 260 },
      children: [],
    }),
  ];
}

function footerNote() {
  return new Paragraph({
    children: [
      new TextRun({
        text:
          `${AUFTRAGNEHMER.firma} · ${AUFTRAGNEHMER.amtsgericht} · ${AUFTRAGNEHMER.hrNummer} · ` +
          `IBAN ${AUFTRAGNEHMER.iban} · ${AUFTRAGNEHMER.bankinstitut} · BIC ${AUFTRAGNEHMER.bic} · ` +
          `USt.-ID ${AUFTRAGNEHMER.ustId} · GF ${AUFTRAGNEHMER.geschaeftsfuehrung}`,
        size: 14,
        color: GRAY,
      }),
    ],
  });
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

function signatureBlock(kundeFirma) {
  const cell = (title, name) =>
    new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      shading: { fill: 'F5F8F8' },
      margin: { top: 150, bottom: 150, left: 150, right: 150 },
      children: [
        new Paragraph({ children: [new TextRun({ text: 'Ort / Datum', size: 16, color: GRAY })] }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CDD3D7', space: 2 } },
          children: [],
        }),
        new Paragraph({ children: [new TextRun({ text: name, bold: true, size: 18 })] }),
        new Paragraph({ children: [new TextRun({ text: title, size: 16, color: GRAY })] }),
      ],
    });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          cell('Auftragnehmer', `${AUFTRAGNEHMER.firma} · ${AUFTRAGNEHMER.geschaeftsfuehrung} (Geschäftsführer)`),
          cell('Auftraggeber', kundeFirma || '[Auftraggeber]'),
        ],
      }),
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
    zahlungszielWerktage = DEFAULT_ZAHLUNGSZIEL_WERKTAGE,
    optionalePositionen = [],
    dsgvoVariante,
    angebotNummer,
    angebotDatum,
    lvDatum,
  } = contract;

  const satz = mwstSatz ?? STANDARD_MWST;
  const brutto = bruttoFromNetto(verguetungNetto, satz);
  const dsgvoInfo = DSGVO_VARIANTEN[dsgvoVariante] || DSGVO_VARIANTEN.standard;

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

  const children = [
    ...letterhead(),
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
      `Die konkreten Leistungen, Reinigungsintervalle und Leistungsflächen sind im beigefügten ` +
        `Leistungsverzeichnis (Anlage 1${lvDatum ? `, Stand: ${formatDateDE(lvDatum)}` : ''}) geregelt, das ` +
        `Bestandteil dieses Vertrages ist.` +
        (angebotNummer
          ? ` Das Angebot ${angebotNummer}${angebotDatum ? ` vom ${formatDateDE(angebotDatum)}` : ''} ist als ` +
            `Anlage 2 Bestandteil dieses Vertrages und gilt insbesondere für die Vergütung optionaler ` +
            `Zusatzpositionen.`
          : '') +
        (dsgvoInfo.braucht_avv
          ? ' Die Vereinbarung zur Auftragsverarbeitung (AVV) ist als Anlage 3 Bestandteil dieses Vertrages.'
          : '')
    ),
    clause(
      '1.3',
      'Dieser Vertrag wird als Werkvertrag im Sinne der §§ 631 ff. BGB geschlossen. Der Auftragnehmer ' +
        'schuldet den vereinbarten Reinigungserfolg, nicht lediglich das Tätigwerden.'
    ),

    heading('Leistungsumfang und Pflichten', 2),
    new Paragraph({ children: [new TextRun({ text: `1. ${leistungsart}`, bold: true })], spacing: { after: 60 } }),
    bullet(`Reinigungsintervall: ${reinigungsintervall || '[Intervall]'}`),
    bullet(`Objekt: ${objektAdresse || '[Objektadresse]'}`),
    bullet(`Gemäß beigefügtem Leistungsverzeichnis${lvDatum ? ` (Stand: ${formatDateDE(lvDatum)})` : ''}`),
    bullet('Reinigung außerhalb der regulären Öffnungszeiten, sofern nicht anders vereinbart'),

    // Optionale Positionen (Auftrag Block 8) - verallgemeinert statt fest auf
    // Glasreinigung zugeschnitten, jede Position bekommt einen eigenen
    // nummerierten Unterabschnitt.
    ...optionalePositionen.flatMap((pos, i) => {
      const posBrutto = bruttoFromNetto(pos.preisNetto, satz);
      const ersteinsatzNetto = pos.ersteinsatzRabatt ? Number(pos.preisNetto || 0) / 2 : null;
      return [
        new Paragraph({
          children: [new TextRun({ text: `${i + 2}. ${pos.name} (Pauschalpreis pro Einsatz)`, bold: true })],
          spacing: { before: 140, after: 60 },
        }),
        bullet(`Reinigungsintervall: ${pos.intervall || 'auf Anfrage'}`),
        bullet(`Objekt: ${objektAdresse || '[Objektadresse]'}`),
        bullet(
          `Vergütung: ${formatEuro(pos.preisNetto)} netto zzgl. ${satz} % MwSt. (${formatEuro(posBrutto)} brutto) je Einsatz`
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
        `Auftragnehmer beschränkt auf den reinen Wiederbeschaffungswert des einzelnen Schlüssels oder ` +
        `Transponders (max. ${formatEuro(HAFTUNG_SCHLUESSEL_EINFACH_EUR)}). Eine darüber hinausgehende Haftung ` +
        'für die Änderung der gesamten Schließanlage ist ausgeschlossen, es sei denn, der Verlust wurde grob ' +
        'fahrlässig verursacht oder eine Schließanlagenänderung ist zur Abwehr eines konkreten ' +
        'Sicherheitsrisikos erforderlich; in diesem Fall haftet der Auftragnehmer für die Kosten einer Teil- ' +
        `oder Komplettänderung der Schließanlage, begrenzt auf ${formatEuro(HAFTUNG_SCHLIESSANLAGE_EUR)} je ` +
        'Schadensfall. Bei Vertragsende sind sämtliche Zugangsmittel spätestens am letzten Werktag der ' +
        'Vertragslaufzeit zurückzugeben.'
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
        'schriftlich mitgeteilt.'
    ),

    heading('Vergütung und Zahlungsbedingungen', 3),
    clause(
      '3.1',
      `Der Auftragnehmer erhält vom Auftraggeber ein monatliches Pauschalhonorar für die ${leistungsart} ` +
        `in Höhe von ${formatEuro(verguetungNetto)} netto zzgl. ${satz} % MwSt., entspricht ${formatEuro(brutto)} ` +
        `brutto.` +
        (optionalePositionen.length > 0
          ? ' Die optionalen Zusatzpositionen werden gemäß den Angaben in § 2 je Einsatz vergütet.'
          : '')
    ),
    clause(
      '3.2',
      `Der Auftragnehmer stellt dem Auftraggeber monatlich eine ordnungsgemäße Rechnung. Die Übermittlung ` +
        `erfolgt in Textform, vorzugsweise per E-Mail. Die Vergütung wird mit Zugang der Rechnung angefordert ` +
        `und ist innerhalb von ${zahlungszielWerktage} Werktagen zu leisten. Bei Zahlungsverzug sind ` +
        `Verzugszinsen in Höhe von ${VERZUGSZINSSATZ_PUNKTE} Prozentpunkten über dem Basiszinssatz gemäß § 288 ` +
        'Abs. 2 BGB geschuldet.'
    ),
    kontodatenTable(),
    new Paragraph({ text: '', spacing: { after: 140 } }),
    clause('3.3', 'Für die ordnungsgemäße Versteuerung der Vergütung ist der Auftragnehmer selbst verantwortlich.'),
    clause(
      '3.3a',
      'Der Auftraggeber ist berechtigt, mit unbestrittenen oder rechtskräftig festgestellten Gegenforderungen ' +
        'aufzurechnen. Bei begründeten und dokumentierten Mängeln ist der Auftraggeber berechtigt, ein ' +
        'Zurückbehaltungsrecht in Höhe des zweifachen Mangelbeseitigungsaufwandes auszuüben, bis der Mangel ' +
        'behoben ist.'
    ),
    clause(
      '3.4',
      'Weicht der tatsächliche Verschmutzungsgrad einmalig und außerordentlich vom vereinbarten Niveau ab, ' +
        'ist der Auftragnehmer zur Mehrleistung ohne zusätzliche Vergütung verpflichtet, sofern der ' +
        'Mehraufwand pro Einsatz 30 Minuten nicht übersteigt. Bei Uneinigkeit über das Ausmaß des ' +
        'Verschmutzungsgrades dokumentieren beide Parteien den Zustand gemeinsam per Foto oder Protokoll vor ' +
        'Beginn der Reinigung. Bei dauerhaft erhöhtem Verschmutzungsgrad oder einem Mehraufwand von mehr als ' +
        '30 Minuten pro Einsatz ist der Auftragnehmer berechtigt, eine schriftliche Vergütungsanpassung zu ' +
        'verlangen. Nicht im Leistungsverzeichnis aufgeführte Arbeiten werden gegen gesonderte, vorher ' +
        'schriftlich zu vereinbarende Vergütung ausgeführt.'
    ),
    clause(
      '3.5',
      'Ändert sich der Tariflohn im Gebäudereinigerhandwerk (Lohngruppe 1 für Unterhaltsreinigung, ' +
        'Lohngruppe 6 für Glasreinigung) um mehr als 3 %, kann jede Partei eine entsprechende Anpassung ' +
        'schriftlich verlangen. Erhöhungen und Senkungen werden gleichermaßen weitergegeben, maximal 5 % pro ' +
        'Kalenderjahr, wirksam einen Monat nach Mitteilung. Bei Erhöhungen über 5 % hat jede Partei ein ' +
        'Sonderkündigungsrecht mit einer Frist von einem Monat zum Monatsende.'
    ),
    clause(
      '3.6',
      'Der Auftraggeber verpflichtet sich, den Auftragnehmer unverzüglich schriftlich zu informieren, sofern ' +
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
        `innerhalb von ${RUEGEFRIST_WERKTAGE} Werktagen (bei Verbrauchern: ${RUEGEFRIST_VERBRAUCHER_WERKTAGE} ` +
        'Werktagen) nach Zugang der Rechnung schriftlich einen oder mehrere Mängel rügt. Die Rüge muss den ' +
        'Mangel hinreichend konkret beschreiben (Art und Ort); eine Sammelrüge mehrerer Mängel ist zulässig. ' +
        'Das Zahlungsziel richtet sich nach § 3.2.'
    ),
    clause(
      '4.2',
      'Bei verdeckten Mängeln, die bei ordnungsgemäßer Untersuchung nicht erkennbar waren, beginnt die ' +
        'Rügefrist abweichend von 4.1 mit dem Zeitpunkt der Entdeckung; die Rüge muss unverzüglich, spätestens ' +
        `innerhalb von ${RUEGEFRIST_WERKTAGE} Werktagen nach Entdeckung (bei Verbrauchern: ` +
        `${RUEGEFRIST_VERBRAUCHER_WERKTAGE} Werktagen), schriftlich unter Angabe von Zeit, Ort, Art und Umfang ` +
        'des Mangels erfolgen.'
    ),
    clause(
      '4.3',
      'Im Falle einer mangelhaften Leistung hat der Auftraggeber dem Auftragnehmer schriftlich eine Frist zur ' +
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
        'Mängelansprüchen wird durch eine schriftliche Mängelrüge bis zur vollständigen Mängelbeseitigung ' +
        'gehemmt.'
    ),

    heading('Haftung und Versicherung', 5),
    clause(
      '5.1',
      'Der Auftragnehmer haftet für Schäden, die er oder seine eingesetzten Mitarbeiter bei der ' +
        'Vertragsdurchführung am Eigentum des Auftraggebers oder Dritter verursachen. Bei Vorsatz und grober ' +
        'Fahrlässigkeit haftet der Auftragnehmer unbeschränkt. Bei leicht fahrlässiger Verletzung ' +
        'wesentlicher Vertragspflichten ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden ' +
        'begrenzt. Bei leicht fahrlässiger Verletzung nicht vertragswesentlicher Nebenpflichten ist die ' +
        'Haftung ausgeschlossen.'
    ),
    clause(
      '5.2',
      `Der Auftragnehmer verpflichtet sich, eine gültige Betriebshaftpflichtversicherung mit einer ` +
        `Deckungssumme von mindestens ${formatEuro(VERSICHERUNGSSUMME_EUR)} pauschal für Sach- und ` +
        'Vermögensschäden vorzuhalten. Der Nachweis ist dem Auftraggeber bei Vertragsschluss sowie auf ' +
        'jährliches Verlangen unverzüglich vorzulegen. Änderungen oder die Kündigung des ' +
        'Versicherungsvertrages sind dem Auftraggeber unverzüglich mitzuteilen.'
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
            `${kuendigungsfristMonate || '[X]'} Monate vor Ablauf der Laufzeit von einer Partei schriftlich ` +
            'gekündigt, verlängert er sich automatisch um jeweils zwölf Monate.'
          : 'auf unbestimmte Zeit geschlossen.')
    ),
    clause(
      '6.2',
      `Der Vertrag kann von jeder Partei mit einer Frist von ${kuendigungsfristMonate || '[X]'} Monaten zum ` +
        'Ende eines Kalendermonats' +
        (laufzeitMonate ? ' erstmals zum Ablauf der Laufzeit' : '') +
        ' schriftlich gekündigt werden.'
    ),
    clause(
      '6.3',
      'Das Recht zur fristlosen Kündigung aus wichtigem Grund bleibt unberührt. Ein wichtiger Grund liegt ' +
        'insbesondere vor bei: (a) einer schwerwiegenden Pflichtverletzung, die trotz schriftlicher Abmahnung ' +
        'nicht innerhalb von 10 Werktagen abgestellt wird; (b) Zahlungsverzug von mehr als 30 Tagen nach ' +
        'schriftlicher Mahnung; (c) Insolvenzantrag einer Vertragspartei; (d) einem Verstoß gegen ' +
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
        `Vertragsstrafe in Höhe von ${formatEuro(VERTRAGSSTRAFE_EUR)} pro Verstoß, unbeschadet weitergehender ` +
        'Schadensersatzansprüche.'
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
      'Bei Widersprüchen zwischen diesem Vertrag und den Anlagen gilt folgende Rangfolge: (1) dieser Vertrag, ' +
        (dsgvoInfo.braucht_avv ? '(2) Vereinbarung zur Auftragsverarbeitung (Anlage 3), (3) ' : '(2) ') +
        'Leistungsverzeichnis (Anlage 1)' +
        (angebotNummer ? ', (4) Angebot (Anlage 2).' : '.')
    ),
    clause(
      '9.4',
      `Erfüllungsort ist ${AUFTRAGNEHMER.ort}. Ausschließlicher Gerichtsstand für alle Streitigkeiten aus ` +
        `diesem Vertrag ist, soweit gesetzlich zulässig, ${AUFTRAGNEHMER.ort}. Es gilt das Recht der ` +
        'Bundesrepublik Deutschland.'
    ),

    new Paragraph({ text: '', spacing: { before: 200, after: 200 } }),
    signatureBlock(kunde.firma),

    new Paragraph({ text: '', spacing: { before: 260 } }),
    new Paragraph({
      children: [
        new TextRun({
          text:
            'Hinweis: Diese Vorlage orientiert sich an einem bereits verwendeten Referenzvertrag, wurde aber ' +
            'für diesen Generator angepasst und automatisiert befüllt. Insbesondere branchenspezifische ' +
            'Klauseln (§ 7.2) und neu hinzugefügte Formulierungen sollten vor produktivem Einsatz in einem ' +
            'neuen Anwendungsfall anwaltlich geprüft werden.',
          italics: true,
          size: 16,
          color: GRAY,
        }),
      ],
    }),
    footerNote(),
  ];

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

// AVV-Baustein (Anlage 3): Vereinbarung zur Auftragsverarbeitung nach
// Art. 28 Abs. 3 DSGVO, für die DSGVO-Klausel-Varianten mit
// braucht_avv: true (siehe contractFields.js). Gleiches Grundprinzip wie
// contractDocx.js: fester Code, keine KI erzeugt hier Vertragstext.
//
// Struktur und Klauseltext 1:1 gegen die echte, unterschriebene Referenz-AVV
// (Anlage3_AVV_Rafael_Weiss_VT-1265, 30.07.2026) abgeglichen (Rechts-Audit
// 2026-07-30) - eine frühere, freier formulierte 13-Paragraphen-Fassung
// dieser Datei wich davon strukturell und inhaltlich stark ab und wurde
// verworfen.
//
// WICHTIG (wie bei § 7.2 des Hauptvertrags): Dies ist eine allgemeine
// Vorlage, keine Einzelfallberatung - vor produktivem Einsatz in einem neuen
// Anwendungsfall anwaltlich prüfen lassen.
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { DSGVO_VARIANTEN, AVV_VARIANTEN, AUFTRAGNEHMER } from './contractFields.js';
import {
  TEAL,
  GRAY,
  heading,
  para,
  clause,
  bullet,
  formatDateDE,
  infoBoxRow,
  noBorders,
  letterhead,
  footerNote,
  signatureBlock,
} from './docxHelpers.js';

export function buildAvvDocument(renderedData) {
  const { kunde = {}, objektAdresse, vertragsnummer, datum, dsgvoVariante } = renderedData || {};
  const dsgvoInfo = DSGVO_VARIANTEN[dsgvoVariante];
  if (!dsgvoInfo || !dsgvoInfo.braucht_avv) {
    throw new Error(`Für die Datenschutz-Variante "${dsgvoVariante}" ist keine AVV erforderlich`);
  }
  const avvInfo = AVV_VARIANTEN[dsgvoVariante] || {
    betroffenePersonen: '[bitte ergänzen]',
    datenartenListe: ['[bitte ergänzen]'],
  };

  // Zweispaltiger Kopf wie im Hauptvertrag (contractDocx.js) statt einer
  // schmalen Vier-Zeilen-Tabelle ohne Adresse - Rechts-Audit 2026-07-31: der
  // Verantwortliche braucht dieselbe vollständige Anschrift wie im
  // Hauptvertrag, nicht nur den Firmennamen.
  const kundeAdresse = [kunde.strasse, [kunde.plz, kunde.ort].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join('\n');

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
              new Paragraph({ children: [new TextRun({ text: 'VERANTWORTLICHER', size: 16, color: GRAY })] }),
              new Paragraph({ children: [new TextRun({ text: kunde.firma || '[Verantwortlicher]', bold: true })] }),
              ...kundeAdresse.split('\n').map((line) => new Paragraph(line)),
              new Paragraph(AUFTRAGNEHMER.land === 'Deutschland' ? 'Deutschland' : ''),
            ],
          }),
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            borders: noBorders(),
            margin: { top: 100, left: 200 },
            children: [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  infoBoxRow('Zum Vertrag', vertragsnummer),
                  infoBoxRow('Datum', formatDateDE(datum)),
                  infoBoxRow('Auftragsverarbeiter', AUFTRAGNEHMER.firma),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const children = [
    ...letterhead(),
    new Paragraph({ children: [new TextRun({ text: 'Anlage 3', bold: true, size: 20, color: '6B7280' })], spacing: { after: 60 } }),
    new Paragraph({
      children: [new TextRun({ text: 'Vereinbarung zur Auftragsverarbeitung', bold: true, size: 36 })],
      spacing: { after: 100 },
    }),
    para('gemäß Art. 28 DSGVO'),
    headerTable,
    new Paragraph({ text: '', spacing: { after: 200 } }),
    para(
      `Der Verantwortliche und der Auftragsverarbeiter schließen diese Vereinbarung zur Auftragsverarbeitung ` +
        `als Anlage 3 zum Reinigungsvertrag ${vertragsnummer || '[Vertragsnummer]'}. Sie konkretisiert die ` +
        'datenschutzrechtlichen Pflichten der Parteien und gilt für die gesamte Laufzeit des ' +
        'Reinigungsvertrages.'
    ),

    heading('Gegenstand, Dauer und Weisungsbindung', 1),
    clause(
      '1.1',
      'Gegenstand der Verarbeitung ist der Zugang zu personenbezogenen Daten, der im Rahmen der Erbringung ' +
        `der im Reinigungsvertrag vereinbarten Unterhaltsreinigung im Objekt ${objektAdresse || '[Objektadresse]'} ` +
        'unvermeidbar entsteht. Eine eigenständige inhaltliche Verarbeitung personenbezogener Daten durch ' +
        'den Auftragsverarbeiter findet nicht statt.'
    ),
    clause(
      '1.2',
      'Die Dauer der Verarbeitung entspricht der Laufzeit des Reinigungsvertrages. Sie endet automatisch mit ' +
        'dessen Beendigung.'
    ),
    clause(
      '1.3',
      'Der Auftragsverarbeiter verarbeitet personenbezogene Daten ausschließlich im Rahmen der getroffenen ' +
        'Vereinbarungen und nach dokumentierten Weisungen des Verantwortlichen. Weisungen erfolgen ' +
        'grundsätzlich in Textform. Mündliche Weisungen sind unverzüglich in Textform zu bestätigen.'
    ),
    clause(
      '1.4',
      'Ist der Auftragsverarbeiter der Auffassung, dass eine Weisung gegen datenschutzrechtliche Vorschriften ' +
        'verstößt, hat er den Verantwortlichen unverzüglich darauf hinzuweisen. Er ist berechtigt, die ' +
        'Durchführung der betreffenden Weisung bis zu deren Bestätigung oder Änderung auszusetzen.'
    ),

    heading('Art der Daten und Kategorien betroffener Personen', 2),
    clause(
      '2.1',
      'Im Rahmen der Reinigungstätigkeit kann der Auftragsverarbeiter zufällig Kenntnis von folgenden ' +
        'Datenarten erlangen:'
    ),
    ...avvInfo.datenartenListe.map((text) => bullet(text)),
    clause('2.2', `Kategorien betroffener Personen sind ${avvInfo.betroffenePersonen}.`),
    clause(
      '2.3',
      'Den Parteien ist bewusst, dass es sich überwiegend um besondere Kategorien personenbezogener Daten ' +
        'nach Art. 9 DSGVO handelt, die einem erhöhten Schutzbedarf unterliegen.'
    ),

    heading('Pflichten des Auftragsverarbeiters', 3),
    clause(
      '3.1',
      'Der Auftragsverarbeiter verarbeitet personenbezogene Daten ausschließlich im Gebiet der Europäischen ' +
        'Union bzw. des Europäischen Wirtschaftsraums. Eine Übermittlung in ein Drittland findet nicht statt.'
    ),
    clause(
      '3.2',
      'Der Auftragsverarbeiter verpflichtet alle mit der Leistungserbringung befassten Personen vor Aufnahme ' +
        'ihrer Tätigkeit schriftlich zur Vertraulichkeit nach Art. 28 Abs. 3 lit. b DSGVO sowie zur Wahrung ' +
        'des Datengeheimnisses. Die Verpflichtung gilt auch nach Beendigung des Beschäftigungsverhältnisses ' +
        'fort. Entsprechende Nachweise werden dem Verantwortlichen vor dem ersten Einsatz unaufgefordert ' +
        'vorgelegt.'
    ),
    clause(
      '3.3',
      'Die eingesetzten Beschäftigten werden ausdrücklich angewiesen, sichtbare Unterlagen, ' +
        'Bildschirminhalte, Karteikarten und sonstige Datenträger weder einzusehen noch zu bewegen, zu ' +
        'kopieren, zu fotografieren oder Dritten zugänglich zu machen. Ordner und Schränke werden nicht ' +
        'geöffnet.'
    ),
    clause(
      '3.4',
      'Der Auftragsverarbeiter setzt die nach Art. 32 DSGVO erforderlichen technischen und organisatorischen ' +
        'Maßnahmen gemäß § 6 dieser Vereinbarung um und hält sie während der Vertragslaufzeit aufrecht.'
    ),
    clause(
      '3.5',
      'Der Auftragsverarbeiter unterstützt den Verantwortlichen im erforderlichen Umfang bei der Erfüllung ' +
        'von Betroffenenrechten nach Art. 12 bis 23 DSGVO sowie bei den Pflichten nach Art. 32 bis 36 DSGVO. ' +
        'Richtet eine betroffene Person ein Auskunfts-, Berichtigungs- oder Löschersuchen unmittelbar an den ' +
        'Auftragsverarbeiter, leitet dieser das Ersuchen unverzüglich an den Verantwortlichen weiter und ' +
        'beantwortet es nicht selbst.'
    ),
    clause(
      '3.6',
      `Der Auftragsverarbeiter benennt eine für den Datenschutz verantwortliche Kontaktperson. Diese ist ` +
        `erreichbar unter ${AUFTRAGNEHMER.email}.`
    ),
    clause(
      '3.7',
      'Der Auftragsverarbeiter führt ein Verzeichnis aller Kategorien von Verarbeitungstätigkeiten nach ' +
        'Art. 30 Abs. 2 DSGVO.'
    ),

    heading('Meldung von Datenschutzverletzungen', 4),
    clause(
      '4.1',
      'Der Auftragsverarbeiter meldet dem Verantwortlichen jede Verletzung des Schutzes personenbezogener ' +
        'Daten unverzüglich, spätestens jedoch innerhalb von 24 Stunden nach Kenntniserlangung, in Textform.'
    ),
    clause(
      '4.2',
      'Die Meldung enthält, soweit verfügbar, eine Beschreibung der Art der Verletzung, die betroffenen ' +
        'Datenkategorien, die ungefähre Zahl betroffener Personen, die wahrscheinlichen Folgen sowie die ' +
        'ergriffenen oder vorgeschlagenen Abhilfemaßnahmen.'
    ),
    clause(
      '4.3',
      'Der Auftragsverarbeiter unterstützt den Verantwortlichen bei dessen Melde- und ' +
        'Benachrichtigungspflichten nach Art. 33 und 34 DSGVO.'
    ),

    heading('Unterauftragsverarbeiter', 5),
    clause(
      '5.1',
      'Der Einsatz weiterer Auftragsverarbeiter (Subunternehmer im Sinne des § 2.6 des Reinigungsvertrages) ' +
        'bedarf der vorherigen gesonderten schriftlichen Genehmigung des Verantwortlichen.'
    ),
    clause('5.2', 'Zum Zeitpunkt des Vertragsschlusses werden keine Unterauftragsverarbeiter eingesetzt.'),
    clause(
      '5.3',
      'Beabsichtigt der Auftragsverarbeiter den Einsatz eines Unterauftragsverarbeiters, teilt er dies dem ' +
        'Verantwortlichen mindestens vier Wochen vorher in Textform mit. Der Verantwortliche kann der ' +
        'Beauftragung innerhalb von zwei Wochen aus wichtigem datenschutzrechtlichem Grund widersprechen.'
    ),
    clause(
      '5.4',
      'Der Auftragsverarbeiter verpflichtet einen Unterauftragsverarbeiter vertraglich auf dieselben ' +
        'Datenschutzpflichten, die ihn selbst aus dieser Vereinbarung treffen, und haftet für dessen Verhalten ' +
        'wie für eigenes.'
    ),

    heading('Technische und organisatorische Maßnahmen (Art. 32 DSGVO)', 6),
    para('Der Auftragsverarbeiter trifft insbesondere die folgenden Maßnahmen:'),
    new Paragraph({ children: [new TextRun({ text: 'Zutrittskontrolle', bold: true })], spacing: { before: 100, after: 40 } }),
    bullet('Zugangsmittel werden namentlich dokumentiert ausgegeben und zurückgenommen'),
    bullet('Schlüssel und Transponder werden ausschließlich an namentlich benannte, verpflichtete Beschäftigte ausgegeben'),
    bullet('Weitergabe von Zugangsmitteln an Dritte ist untersagt'),
    bullet('Verlust ist unverzüglich zu melden; Regelungen nach § 2.3 des Reinigungsvertrages gelten ergänzend'),
    new Paragraph({
      children: [new TextRun({ text: 'Zugangs- und Zugriffskontrolle', bold: true })],
      spacing: { before: 100, after: 40 },
    }),
    bullet('Keine Nutzung von IT-Systemen, Endgeräten oder Netzwerken des Verantwortlichen'),
    bullet('Keine Einsichtnahme in Unterlagen, Bildschirminhalte oder Datenträger'),
    bullet('Verbot der Anfertigung von Fotografien, Kopien oder Scans in den Räumlichkeiten'),
    bullet('Private Mobiltelefone dürfen in Behandlungs- und Praxisräumen nicht zur Bildaufnahme verwendet werden'),
    new Paragraph({ children: [new TextRun({ text: 'Organisation und Personal', bold: true })], spacing: { before: 100, after: 40 } }),
    bullet('Schriftliche Verpflichtung auf Vertraulichkeit und Datengeheimnis vor Tätigkeitsbeginn'),
    bullet('Datenschutzunterweisung bei Einstellung und danach mindestens jährlich, dokumentiert'),
    bullet('Feste, dem Verantwortlichen benannte Einsatzkräfte; Wechsel werden vorab mitgeteilt'),
    bullet('Führung einer Einsatzdokumentation mit Datum, Uhrzeit und eingesetzten Personen'),
    new Paragraph({
      children: [new TextRun({ text: 'Weitergabe- und Auftragskontrolle', bold: true })],
      spacing: { before: 100, after: 40 },
    }),
    bullet('Keine Weitergabe personenbezogener Daten an Dritte'),
    bullet('Kein Transport von Unterlagen oder Datenträgern aus den Räumlichkeiten'),
    bullet('Aufgefundene Unterlagen werden unberührt gelassen und dem Verantwortlichen gemeldet'),
    bullet('Keine Entsorgung von Papierabfällen aus Bereichen mit Patientenbezug ohne ausdrückliche Weisung; Aktenvernichtung ist nicht Gegenstand des Auftrags'),

    heading('Nachweise und Kontrollrechte', 7),
    clause(
      '7.1',
      'Der Auftragsverarbeiter weist dem Verantwortlichen auf Anforderung die Einhaltung der in dieser ' +
        'Vereinbarung festgelegten Pflichten in geeigneter Weise nach.'
    ),
    clause(
      '7.2',
      'Der Verantwortliche ist berechtigt, sich nach vorheriger Anmeldung mit angemessener Frist von der ' +
        'Einhaltung der Maßnahmen zu überzeugen. Kontrollen erfolgen zu üblichen Geschäftszeiten und ohne ' +
        'vermeidbare Störung des Betriebsablaufs.'
    ),
    clause(
      '7.3',
      'Der Auftragsverarbeiter stellt dem Verantwortlichen alle erforderlichen Informationen zum Nachweis der ' +
        'Einhaltung der Pflichten nach Art. 28 DSGVO zur Verfügung.'
    ),

    heading('Beendigung, Rückgabe und Löschung', 8),
    clause(
      '8.1',
      'Nach Beendigung des Reinigungsvertrages gibt der Auftragsverarbeiter sämtliche überlassenen ' +
        'Zugangsmittel, Unterlagen und etwaige Aufzeichnungen unverzüglich, spätestens am letzten Werktag der ' +
        'Vertragslaufzeit, zurück.'
    ),
    clause(
      '8.2',
      'Etwaige beim Auftragsverarbeiter vorhandene Aufzeichnungen mit Personenbezug werden nach Wahl des ' +
        'Verantwortlichen zurückgegeben oder datenschutzkonform gelöscht bzw. vernichtet. Die Löschung wird ' +
        'auf Verlangen in Textform bestätigt.'
    ),
    clause(
      '8.3',
      'Gesetzliche Aufbewahrungspflichten bleiben unberührt. Für die Dauer der Aufbewahrung gelten die ' +
        'Pflichten dieser Vereinbarung fort.'
    ),

    heading('Haftung und Schlussbestimmungen', 9),
    clause('9.1', 'Für die Haftung gelten die Regelungen des Reinigungsvertrages, insbesondere § 5, sowie Art. 82 DSGVO.'),
    clause('9.2', 'Die Vertragsstrafenregelung nach § 7.5 des Reinigungsvertrages bleibt unberührt.'),
    clause(
      '9.3',
      'Änderungen und Ergänzungen dieser Vereinbarung bedürfen der Schriftform. Dies gilt auch für die ' +
        'Aufhebung dieses Schriftformerfordernisses.'
    ),
    clause(
      '9.4',
      'Sollte eine Bestimmung dieser Vereinbarung unwirksam sein, bleibt die Wirksamkeit der übrigen ' +
        'Bestimmungen unberührt. Die Parteien ersetzen die unwirksame Bestimmung durch eine wirksame ' +
        'Regelung, die dem verfolgten Zweck am nächsten kommt.'
    ),
    clause(
      '9.5',
      'Bei Widersprüchen zwischen dieser Vereinbarung und dem Reinigungsvertrag gehen die Regelungen dieser ' +
        'Vereinbarung vor, soweit sie den Datenschutz betreffen.'
    ),
    clause('9.6', 'Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand ist, soweit gesetzlich zulässig, Köln.'),

    new Paragraph({ text: '', spacing: { before: 200, after: 260 } }),
    signatureBlock(kunde.firma, { leftLabel: 'Auftragsverarbeiter', rightLabel: 'Verantwortlicher' }),

    new Paragraph({ text: '', spacing: { before: 260 } }),
    footerNote(),
  ];

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

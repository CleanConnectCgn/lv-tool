// PDF-Fassung der AVV (Anlage 3) - eigenständiger Renderer (jsPDF), analog
// zu contractPdf.js. Gleiches Grundprinzip: KEINE DOCX-zu-PDF-Konvertierung,
// Klauseltext 1:1 aus server/lib/render/avvDocx.js übernommen.
//
// WICHTIG FÜR KÜNFTIGE ÄNDERUNGEN: Jede inhaltliche Änderung an einer Klausel
// in avvDocx.js muss hier 1:1 nachgezogen werden (und umgekehrt) - kein
// automatischer Abgleich. avvPdf.test.js prüft per pdftotext echten
// Text-Inhalt, das fängt grobe Abweichungen ab, ersetzt aber keinen
// manuellen Soll-Ist-Vergleich bei Textänderungen.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DSGVO_VARIANTEN, AVV_VARIANTEN, AUFTRAGNEHMER } from './contractFields.js';
import { formatDateDE } from './docxHelpers.js';
import {
  TEAL,
  INK,
  GRAY,
  LINE,
  SEC_BG,
  PAGE_W,
  MARGIN_X,
  CONTENT_W,
  headingRow,
  clauseRow,
  paraRow,
  bulletRow,
  boldRow,
  drawLetterhead,
  drawFurniture,
  drawSignatureBlock,
  buildAutoTableBody,
} from './pdfHelpers.js';

// Zweispaltiger Kopf wie im Hauptvertrag (contractPdf.js drawHeaderBox)
// statt einer schmalen Vier-Zeilen-Box ohne Adresse - Rechts-Audit
// 2026-07-31: der Verantwortliche braucht dieselbe vollständige Anschrift
// wie im Hauptvertrag, nicht nur den Firmennamen.
function drawHeaderBox(doc, { vertragsnummer, datum, kunde }) {
  const y0 = 24;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text('Vereinbarung zur Auftragsverarbeitung', MARGIN_X, y0 + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  doc.text('gemäß Art. 28 DSGVO', MARGIN_X, y0 + 12);

  const kundeAdresseZeilen = [
    kunde.strasse,
    [kunde.plz, kunde.ort].filter(Boolean).join(' '),
    AUFTRAGNEHMER.land === 'Deutschland' ? 'Deutschland' : '',
  ].filter(Boolean);

  const boxY = y0 + 16;
  const lineHeight = 4.6;
  const RIGHT_COL_MIN_H = 24;
  const boxH = Math.max(RIGHT_COL_MIN_H, 9 + kundeAdresseZeilen.length * lineHeight);
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
  doc.text('VERANTWORTLICHER', MARGIN_X + 4, boxY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(kunde.firma || '[Verantwortlicher]', MARGIN_X + 4, boxY + 9.5, { maxWidth: 90 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  kundeAdresseZeilen.forEach((line, i) => {
    doc.text(line, MARGIN_X + 4, boxY + 13.5 + i * lineHeight, { maxWidth: 90 });
  });

  const rightX = PAGE_W - MARGIN_X - 4;
  const infoLine = (label, value, offsetY) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY);
    doc.text(label, rightX, boxY + offsetY, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(value || '—', rightX, boxY + offsetY + 4.5, { align: 'right' });
  };
  infoLine('Zum Vertrag', vertragsnummer, 5);
  infoLine('Datum', formatDateDE(datum), 12);
  infoLine('Auftragsverarbeiter', AUFTRAGNEHMER.firma, 19);

  return boxY + boxH + 6;
}

export function buildAvvPdf(renderedData) {
  const { kunde = {}, objektAdresse, vertragsnummer, datum, dsgvoVariante } = renderedData || {};
  const dsgvoInfo = DSGVO_VARIANTEN[dsgvoVariante];
  if (!dsgvoInfo || !dsgvoInfo.braucht_avv) {
    throw new Error(`Für die Datenschutz-Variante "${dsgvoVariante}" ist keine AVV erforderlich`);
  }
  const avvInfo = AVV_VARIANTEN[dsgvoVariante] || {
    betroffenePersonen: '[bitte ergänzen]',
    datenartenListe: ['[bitte ergänzen]'],
  };

  const body = [
    paraRow(
      `Der Verantwortliche und der Auftragsverarbeiter schließen diese Vereinbarung zur Auftragsverarbeitung ` +
        `als Anlage 3 zum Reinigungsvertrag ${vertragsnummer || '[Vertragsnummer]'}. Sie konkretisiert die ` +
        'datenschutzrechtlichen Pflichten der Parteien und gilt für die gesamte Laufzeit des ' +
        'Reinigungsvertrages.'
    ),

    headingRow(1, 'Gegenstand, Dauer und Weisungsbindung'),
    clauseRow(
      '1.1',
      'Gegenstand der Verarbeitung ist der Zugang zu personenbezogenen Daten, der im Rahmen der Erbringung ' +
        `der im Reinigungsvertrag vereinbarten Unterhaltsreinigung im Objekt ${objektAdresse || '[Objektadresse]'} ` +
        'unvermeidbar entsteht. Eine eigenständige inhaltliche Verarbeitung personenbezogener Daten durch ' +
        'den Auftragsverarbeiter findet nicht statt.'
    ),
    clauseRow(
      '1.2',
      'Die Dauer der Verarbeitung entspricht der Laufzeit des Reinigungsvertrages. Sie endet automatisch mit ' +
        'dessen Beendigung.'
    ),
    clauseRow(
      '1.3',
      'Der Auftragsverarbeiter verarbeitet personenbezogene Daten ausschließlich im Rahmen der getroffenen ' +
        'Vereinbarungen und nach dokumentierten Weisungen des Verantwortlichen. Weisungen erfolgen ' +
        'grundsätzlich in Textform. Mündliche Weisungen sind unverzüglich in Textform zu bestätigen.'
    ),
    clauseRow(
      '1.4',
      'Ist der Auftragsverarbeiter der Auffassung, dass eine Weisung gegen datenschutzrechtliche Vorschriften ' +
        'verstößt, hat er den Verantwortlichen unverzüglich darauf hinzuweisen. Er ist berechtigt, die ' +
        'Durchführung der betreffenden Weisung bis zu deren Bestätigung oder Änderung auszusetzen.'
    ),

    headingRow(2, 'Art der Daten und Kategorien betroffener Personen'),
    clauseRow(
      '2.1',
      'Im Rahmen der Reinigungstätigkeit kann der Auftragsverarbeiter zufällig Kenntnis von folgenden ' +
        'Datenarten erlangen:'
    ),
    ...avvInfo.datenartenListe.map((text) => bulletRow(text)),
    clauseRow('2.2', `Kategorien betroffener Personen sind ${avvInfo.betroffenePersonen}.`),
    clauseRow(
      '2.3',
      'Den Parteien ist bewusst, dass es sich überwiegend um besondere Kategorien personenbezogener Daten ' +
        'nach Art. 9 DSGVO handelt, die einem erhöhten Schutzbedarf unterliegen.'
    ),

    headingRow(3, 'Pflichten des Auftragsverarbeiters'),
    clauseRow(
      '3.1',
      'Der Auftragsverarbeiter verarbeitet personenbezogene Daten ausschließlich im Gebiet der Europäischen ' +
        'Union bzw. des Europäischen Wirtschaftsraums. Eine Übermittlung in ein Drittland findet nicht statt.'
    ),
    clauseRow(
      '3.2',
      'Der Auftragsverarbeiter verpflichtet alle mit der Leistungserbringung befassten Personen vor Aufnahme ' +
        'ihrer Tätigkeit schriftlich zur Vertraulichkeit nach Art. 28 Abs. 3 lit. b DSGVO sowie zur Wahrung ' +
        'des Datengeheimnisses. Die Verpflichtung gilt auch nach Beendigung des Beschäftigungsverhältnisses ' +
        'fort. Entsprechende Nachweise werden dem Verantwortlichen vor dem ersten Einsatz unaufgefordert ' +
        'vorgelegt.'
    ),
    clauseRow(
      '3.3',
      'Die eingesetzten Beschäftigten werden ausdrücklich angewiesen, sichtbare Unterlagen, ' +
        'Bildschirminhalte, Karteikarten und sonstige Datenträger weder einzusehen noch zu bewegen, zu ' +
        'kopieren, zu fotografieren oder Dritten zugänglich zu machen. Ordner und Schränke werden nicht ' +
        'geöffnet.'
    ),
    clauseRow(
      '3.4',
      'Der Auftragsverarbeiter setzt die nach Art. 32 DSGVO erforderlichen technischen und organisatorischen ' +
        'Maßnahmen gemäß § 6 dieser Vereinbarung um und hält sie während der Vertragslaufzeit aufrecht.'
    ),
    clauseRow(
      '3.5',
      'Der Auftragsverarbeiter unterstützt den Verantwortlichen im erforderlichen Umfang bei der Erfüllung ' +
        'von Betroffenenrechten nach Art. 12 bis 23 DSGVO sowie bei den Pflichten nach Art. 32 bis 36 DSGVO. ' +
        'Richtet eine betroffene Person ein Auskunfts-, Berichtigungs- oder Löschersuchen unmittelbar an den ' +
        'Auftragsverarbeiter, leitet dieser das Ersuchen unverzüglich an den Verantwortlichen weiter und ' +
        'beantwortet es nicht selbst.'
    ),
    clauseRow(
      '3.6',
      `Der Auftragsverarbeiter benennt eine für den Datenschutz verantwortliche Kontaktperson. Diese ist ` +
        `erreichbar unter ${AUFTRAGNEHMER.email}.`
    ),
    clauseRow(
      '3.7',
      'Der Auftragsverarbeiter führt ein Verzeichnis aller Kategorien von Verarbeitungstätigkeiten nach ' +
        'Art. 30 Abs. 2 DSGVO.'
    ),

    headingRow(4, 'Meldung von Datenschutzverletzungen'),
    clauseRow(
      '4.1',
      'Der Auftragsverarbeiter meldet dem Verantwortlichen jede Verletzung des Schutzes personenbezogener ' +
        'Daten unverzüglich, spätestens jedoch innerhalb von 24 Stunden nach Kenntniserlangung, in Textform.'
    ),
    clauseRow(
      '4.2',
      'Die Meldung enthält, soweit verfügbar, eine Beschreibung der Art der Verletzung, die betroffenen ' +
        'Datenkategorien, die ungefähre Zahl betroffener Personen, die wahrscheinlichen Folgen sowie die ' +
        'ergriffenen oder vorgeschlagenen Abhilfemaßnahmen.'
    ),
    clauseRow(
      '4.3',
      'Der Auftragsverarbeiter unterstützt den Verantwortlichen bei dessen Melde- und ' +
        'Benachrichtigungspflichten nach Art. 33 und 34 DSGVO.'
    ),

    headingRow(5, 'Unterauftragsverarbeiter'),
    clauseRow(
      '5.1',
      'Der Einsatz weiterer Auftragsverarbeiter (Subunternehmer im Sinne des § 2.6 des Reinigungsvertrages) ' +
        'bedarf der vorherigen gesonderten schriftlichen Genehmigung des Verantwortlichen.'
    ),
    clauseRow('5.2', 'Zum Zeitpunkt des Vertragsschlusses werden keine Unterauftragsverarbeiter eingesetzt.'),
    clauseRow(
      '5.3',
      'Beabsichtigt der Auftragsverarbeiter den Einsatz eines Unterauftragsverarbeiters, teilt er dies dem ' +
        'Verantwortlichen mindestens vier Wochen vorher in Textform mit. Der Verantwortliche kann der ' +
        'Beauftragung innerhalb von zwei Wochen aus wichtigem datenschutzrechtlichem Grund widersprechen.'
    ),
    clauseRow(
      '5.4',
      'Der Auftragsverarbeiter verpflichtet einen Unterauftragsverarbeiter vertraglich auf dieselben ' +
        'Datenschutzpflichten, die ihn selbst aus dieser Vereinbarung treffen, und haftet für dessen Verhalten ' +
        'wie für eigenes.'
    ),

    headingRow(6, 'Technische und organisatorische Maßnahmen (Art. 32 DSGVO)'),
    paraRow('Der Auftragsverarbeiter trifft insbesondere die folgenden Maßnahmen:'),
    boldRow('Zutrittskontrolle'),
    bulletRow('Zugangsmittel werden namentlich dokumentiert ausgegeben und zurückgenommen'),
    bulletRow('Schlüssel und Transponder werden ausschließlich an namentlich benannte, verpflichtete Beschäftigte ausgegeben'),
    bulletRow('Weitergabe von Zugangsmitteln an Dritte ist untersagt'),
    bulletRow('Verlust ist unverzüglich zu melden; Regelungen nach § 2.3 des Reinigungsvertrages gelten ergänzend'),
    boldRow('Zugangs- und Zugriffskontrolle'),
    bulletRow('Keine Nutzung von IT-Systemen, Endgeräten oder Netzwerken des Verantwortlichen'),
    bulletRow('Keine Einsichtnahme in Unterlagen, Bildschirminhalte oder Datenträger'),
    bulletRow('Verbot der Anfertigung von Fotografien, Kopien oder Scans in den Räumlichkeiten'),
    bulletRow('Private Mobiltelefone dürfen in Behandlungs- und Praxisräumen nicht zur Bildaufnahme verwendet werden'),
    boldRow('Organisation und Personal'),
    bulletRow('Schriftliche Verpflichtung auf Vertraulichkeit und Datengeheimnis vor Tätigkeitsbeginn'),
    bulletRow('Datenschutzunterweisung bei Einstellung und danach mindestens jährlich, dokumentiert'),
    bulletRow('Feste, dem Verantwortlichen benannte Einsatzkräfte; Wechsel werden vorab mitgeteilt'),
    bulletRow('Führung einer Einsatzdokumentation mit Datum, Uhrzeit und eingesetzten Personen'),
    boldRow('Weitergabe- und Auftragskontrolle'),
    bulletRow('Keine Weitergabe personenbezogener Daten an Dritte'),
    bulletRow('Kein Transport von Unterlagen oder Datenträgern aus den Räumlichkeiten'),
    bulletRow('Aufgefundene Unterlagen werden unberührt gelassen und dem Verantwortlichen gemeldet'),
    bulletRow('Keine Entsorgung von Papierabfällen aus Bereichen mit Patientenbezug ohne ausdrückliche Weisung; Aktenvernichtung ist nicht Gegenstand des Auftrags'),

    headingRow(7, 'Nachweise und Kontrollrechte'),
    clauseRow(
      '7.1',
      'Der Auftragsverarbeiter weist dem Verantwortlichen auf Anforderung die Einhaltung der in dieser ' +
        'Vereinbarung festgelegten Pflichten in geeigneter Weise nach.'
    ),
    clauseRow(
      '7.2',
      'Der Verantwortliche ist berechtigt, sich nach vorheriger Anmeldung mit angemessener Frist von der ' +
        'Einhaltung der Maßnahmen zu überzeugen. Kontrollen erfolgen zu üblichen Geschäftszeiten und ohne ' +
        'vermeidbare Störung des Betriebsablaufs.'
    ),
    clauseRow(
      '7.3',
      'Der Auftragsverarbeiter stellt dem Verantwortlichen alle erforderlichen Informationen zum Nachweis der ' +
        'Einhaltung der Pflichten nach Art. 28 DSGVO zur Verfügung.'
    ),

    headingRow(8, 'Beendigung, Rückgabe und Löschung'),
    clauseRow(
      '8.1',
      'Nach Beendigung des Reinigungsvertrages gibt der Auftragsverarbeiter sämtliche überlassenen ' +
        'Zugangsmittel, Unterlagen und etwaige Aufzeichnungen unverzüglich, spätestens am letzten Werktag der ' +
        'Vertragslaufzeit, zurück.'
    ),
    clauseRow(
      '8.2',
      'Etwaige beim Auftragsverarbeiter vorhandene Aufzeichnungen mit Personenbezug werden nach Wahl des ' +
        'Verantwortlichen zurückgegeben oder datenschutzkonform gelöscht bzw. vernichtet. Die Löschung wird ' +
        'auf Verlangen in Textform bestätigt.'
    ),
    clauseRow(
      '8.3',
      'Gesetzliche Aufbewahrungspflichten bleiben unberührt. Für die Dauer der Aufbewahrung gelten die ' +
        'Pflichten dieser Vereinbarung fort.'
    ),

    headingRow(9, 'Haftung und Schlussbestimmungen'),
    clauseRow('9.1', 'Für die Haftung gelten die Regelungen des Reinigungsvertrages, insbesondere § 5, sowie Art. 82 DSGVO.'),
    clauseRow('9.2', 'Die Vertragsstrafenregelung nach § 7.5 des Reinigungsvertrages bleibt unberührt.'),
    clauseRow(
      '9.3',
      'Änderungen und Ergänzungen dieser Vereinbarung bedürfen der Schriftform. Dies gilt auch für die ' +
        'Aufhebung dieses Schriftformerfordernisses.'
    ),
    clauseRow(
      '9.4',
      'Sollte eine Bestimmung dieser Vereinbarung unwirksam sein, bleibt die Wirksamkeit der übrigen ' +
        'Bestimmungen unberührt. Die Parteien ersetzen die unwirksame Bestimmung durch eine wirksame ' +
        'Regelung, die dem verfolgten Zweck am nächsten kommt.'
    ),
    clauseRow(
      '9.5',
      'Bei Widersprüchen zwischen dieser Vereinbarung und dem Reinigungsvertrag gehen die Regelungen dieser ' +
        'Vereinbarung vor, soweit sie den Datenschutz betreffen.'
    ),
    clauseRow('9.6', 'Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand ist, soweit gesetzlich zulässig, Köln.'),
  ];

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  drawLetterhead(doc);
  const startY = drawHeaderBox(doc, { vertragsnummer, datum, kunde });

  autoTable(doc, buildAutoTableBody(doc, { startY, body }));

  drawSignatureBlock(doc, kunde.firma, { leftLabel: 'Auftragsverarbeiter', rightLabel: 'Verantwortlicher' });
  drawFurniture(doc);
  return Buffer.from(doc.output('arraybuffer'));
}

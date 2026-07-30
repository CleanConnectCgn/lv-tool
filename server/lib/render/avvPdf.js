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
  INK,
  GRAY,
  LINE,
  SEC_BG,
  PAGE_W,
  MARGIN_X,
  CONTENT_W,
  headingRow,
  clauseRow,
  bulletRow,
  hinweisRow,
  drawLetterhead,
  drawFurniture,
  drawSignatureBlock,
  buildAutoTableBody,
} from './pdfHelpers.js';

function drawHeaderBox(doc, { vertragsnummer, datum, kunde }) {
  const y0 = 24;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...INK);
  doc.text('Anlage 3 — Vereinbarung zur Auftragsverarbeitung (AVV)', MARGIN_X, y0 + 5, { maxWidth: CONTENT_W });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  doc.text(`gemäß Art. 28 DSGVO, Bestandteil des Reinigungsvertrags ${vertragsnummer || '[Vertragsnummer]'}`, MARGIN_X, y0 + 11);

  const boxY = y0 + 15;
  const rowH = 5.5;
  const boxH = rowH * 4;
  doc.setFillColor(...SEC_BG);
  doc.rect(MARGIN_X, boxY, CONTENT_W, boxH, 'F');

  const row = (label, value, i) => {
    const ry = boxY + i * rowH + rowH / 2 + 1.2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text(label, MARGIN_X + 4, ry);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(value || '—', MARGIN_X + 70, ry);
  };
  row('Zu Vertrag', vertragsnummer, 0);
  row('Datum', formatDateDE(datum), 1);
  row('Verantwortlicher (Auftraggeber)', kunde.firma, 2);
  row('Auftragsverarbeiter', AUFTRAGNEHMER.firma, 3);

  return boxY + boxH + 6;
}

export function buildAvvPdf(renderedData) {
  const { kunde = {}, vertragsnummer, datum, dsgvoVariante } = renderedData || {};
  const dsgvoInfo = DSGVO_VARIANTEN[dsgvoVariante];
  if (!dsgvoInfo || !dsgvoInfo.braucht_avv) {
    throw new Error(`Für die Datenschutz-Variante "${dsgvoVariante}" ist keine AVV erforderlich`);
  }
  const avvInfo = AVV_VARIANTEN[dsgvoVariante] || {
    kategorienBetroffenerPersonen: '[bitte ergänzen]',
    datenarten: '[bitte ergänzen]',
  };

  const body = [
    headingRow(1, 'Gegenstand und Dauer der Verarbeitung'),
    clauseRow(
      '1.1',
      'Gegenstand dieser Vereinbarung ist die Verarbeitung personenbezogener Daten, von denen der ' +
        'Auftragsverarbeiter im Rahmen der im Hauptvertrag beschriebenen Reinigungsleistungen zufällig ' +
        'Kenntnis erlangen kann.'
    ),
    clauseRow(
      '1.2',
      'Die Dauer dieser Vereinbarung entspricht der Laufzeit des Hauptvertrags; sie endet nicht automatisch ' +
        'vor vollständiger Erfüllung der Pflichten aus § 10 (Löschung und Rückgabe).'
    ),

    headingRow(2, 'Art und Zweck der Verarbeitung'),
    clauseRow(
      '2.1',
      'Eine gezielte, planmäßige Verarbeitung personenbezogener Daten ist nicht Gegenstand der Beauftragung. ' +
        'Der Auftragsverarbeiter erlangt ausschließlich zufällig, im Zuge der eigentlichen Reinigungsleistung, ' +
        'Kenntnis von personenbezogenen Daten (z.B. durch Sichtkontakt zu Unterlagen, Bildschirmen oder ' +
        'Datenträgern).'
    ),
    clauseRow('2.2', 'Zweck der Verarbeitung ist ausschließlich die ordnungsgemäße Erbringung der vereinbarten Reinigungsleistung.'),

    headingRow(3, 'Art der Daten und Kategorien betroffener Personen'),
    bulletRow(`Kategorien betroffener Personen: ${avvInfo.kategorienBetroffenerPersonen}`),
    bulletRow(`Art der Daten: ${avvInfo.datenarten}`),

    headingRow(4, 'Weisungsgebundenheit'),
    clauseRow(
      '4.1',
      'Der Auftragsverarbeiter verarbeitet personenbezogene Daten ausschließlich auf dokumentierte Weisung ' +
        'des Verantwortlichen (Art. 29, Art. 28 Abs. 3 lit. a DSGVO), es sei denn, er ist nach dem Recht der ' +
        'Union oder der Mitgliedstaaten zur Verarbeitung verpflichtet.'
    ),
    clauseRow(
      '4.2',
      'Da die Verarbeitung nach § 2 auf zufällige Kenntnisnahme beschränkt ist, besteht die maßgebliche ' +
        'Weisung im Kern in der Einhaltung von § 5 (Vertraulichkeit) dieser Vereinbarung sowie der ' +
        'einschlägigen Klauseln des Hauptvertrags (insbesondere § 7 Datenschutz und Vertraulichkeit).'
    ),

    headingRow(5, 'Vertraulichkeit'),
    clauseRow(
      '5.1',
      'Der Auftragsverarbeiter stellt sicher, dass sich alle zur Verarbeitung befugten Personen zur ' +
        'Vertraulichkeit verpflichtet haben (Art. 28 Abs. 3 lit. b, Art. 29, Art. 32 Abs. 4 DSGVO) oder einer ' +
        'angemessenen gesetzlichen Verschwiegenheitspflicht unterliegen, bevor sie erstmals eingesetzt werden.'
    ),

    headingRow(6, 'Technische und organisatorische Maßnahmen'),
    clauseRow(
      '6.1',
      'Der Auftragsverarbeiter trifft die zur Gewährleistung eines dem Risiko angemessenen Schutzniveaus ' +
        'erforderlichen technischen und organisatorischen Maßnahmen gemäß Art. 32 DSGVO. Dazu zählen ' +
        'insbesondere: schriftliche Vertraulichkeitsverpflichtung des Personals vor Tätigkeitsbeginn (siehe ' +
        '§ 5), Anweisung, sichtbare Unterlagen/Bildschirminhalte/Datenträger weder zu lesen noch zu kopieren, ' +
        'zu fotografieren oder zu bewegen, sowie eine unverzügliche interne Meldekette bei erkannten ' +
        'Auffälligkeiten (siehe § 9).'
    ),
    clauseRow(
      '6.2',
      'Der Auftragsverarbeiter weist die Umsetzung der Maßnahmen auf Verlangen des Verantwortlichen nach ' +
        '(siehe § 11).'
    ),

    headingRow(7, 'Unterauftragsverarbeiter'),
    clauseRow(
      '7.1',
      'Setzt der Auftragsverarbeiter gemäß § 2.6 des Hauptvertrags Subunternehmer ein, gilt dies als ' +
        'allgemeine Genehmigung zur Beauftragung weiterer Auftragsverarbeiter im Sinne von Art. 28 Abs. 2 ' +
        'DSGVO. Der Auftragsverarbeiter informiert den Verantwortlichen über jede beabsichtigte Änderung in ' +
        'Bezug auf die Hinzuziehung oder Ersetzung solcher Subunternehmer, sodass der Verantwortliche ' +
        'ausreichend Zeit hat, gegen diese Änderungen Einspruch zu erheben.'
    ),
    clauseRow(
      '7.2',
      'Der Auftragsverarbeiter verpflichtet eingesetzte Subunternehmer auf die gleichen Datenschutzpflichten, ' +
        'wie sie sich aus dieser Vereinbarung ergeben.'
    ),

    headingRow(8, 'Unterstützung bei der Wahrnehmung von Betroffenenrechten'),
    clauseRow(
      '8.1',
      'Soweit möglich, unterstützt der Auftragsverarbeiter den Verantwortlichen mit geeigneten technischen ' +
        'und organisatorischen Maßnahmen bei der Erfüllung von dessen Pflicht zur Beantwortung von Anträgen ' +
        'auf Wahrnehmung der Betroffenenrechte (Art. 12 bis 22 DSGVO). Da der Auftragsverarbeiter selbst ' +
        'keine strukturierten personenbezogenen Daten des Verantwortlichen speichert (siehe § 2), beschränkt ' +
        'sich dies praktisch auf die unverzügliche Weiterleitung entsprechender Anfragen an den ' +
        'Verantwortlichen.'
    ),

    headingRow(9, 'Unterstützung bei Sicherheit der Verarbeitung und Meldepflichten'),
    clauseRow(
      '9.1',
      'Stellt der Auftragsverarbeiter bei seiner Tätigkeit Anhaltspunkte für eine Verletzung des Schutzes ' +
        'personenbezogener Daten fest (z.B. offensichtlich unbefugten Zugriff Dritter auf Unterlagen oder ' +
        'IT-Systeme), informiert er den Verantwortlichen unverzüglich, spätestens innerhalb von 24 Stunden ' +
        'nach Kenntnisnahme (siehe bereits § 7 des Hauptvertrags), damit dieser seinen Melde- und ' +
        'Benachrichtigungspflichten nach Art. 33, 34 DSGVO nachkommen kann.'
    ),
    clauseRow(
      '9.2',
      'Der Auftragsverarbeiter unterstützt den Verantwortlichen auf Anfrage bei der Erstellung von ' +
        'Datenschutz-Folgenabschätzungen (Art. 35 DSGVO), soweit die Verarbeitung durch den ' +
        'Auftragsverarbeiter davon betroffen ist.'
    ),

    headingRow(10, 'Löschung und Rückgabe'),
    clauseRow(
      '10.1',
      'Der Auftragsverarbeiter verarbeitet und speichert im Rahmen seiner Tätigkeit grundsätzlich keine ' +
        'personenbezogenen Daten des Verantwortlichen in eigenen Systemen (siehe § 2). Sollten im Einzelfall ' +
        'dennoch Aufzeichnungen entstehen (z.B. Fotodokumentation eines Schadensfalls, die zufällig ' +
        'personenbezogene Daten enthält), löscht der Auftragsverarbeiter diese unverzüglich nach Wegfall des ' +
        'ursprünglichen Zwecks, spätestens mit Beendigung des Hauptvertrags, sofern keine gesetzliche ' +
        'Aufbewahrungspflicht entgegensteht.'
    ),

    headingRow(11, 'Kontrollrechte des Verantwortlichen'),
    clauseRow(
      '11.1',
      'Der Verantwortliche hat das Recht, die Einhaltung der in dieser Vereinbarung festgelegten Pflichten ' +
        'beim Auftragsverarbeiter zu überprüfen bzw. durch beauftragte Dritte überprüfen zu lassen, ' +
        'insbesondere durch Einholung von Auskünften und Einsicht in die Nachweise über die Umsetzung der ' +
        'technischen und organisatorischen Maßnahmen (§ 6). Kontrollen vor Ort werden mit angemessenem ' +
        'zeitlichem Vorlauf (mindestens 5 Werktage) schriftlich angekündigt und finden während der üblichen ' +
        'Geschäftszeiten statt.'
    ),

    headingRow(12, 'Haftung'),
    clauseRow(
      '12.1',
      'Für die Haftung gelten die Regelungen des Hauptvertrags (§ 5 Haftung und Versicherung) entsprechend, ' +
        'soweit diese Vereinbarung keine abweichenden Regelungen trifft. Zwingende gesetzliche ' +
        'Haftungsvorschriften der DSGVO (insbesondere Art. 82 DSGVO) bleiben unberührt.'
    ),

    headingRow(13, 'Schlussbestimmungen'),
    clauseRow(
      '13.1',
      'Diese Vereinbarung ist Bestandteil des Hauptvertrags. Bei Widersprüchen zwischen dieser Vereinbarung ' +
        'und dem Hauptvertrag gehen die Regelungen dieser Vereinbarung in datenschutzrechtlichen Fragen vor.'
    ),
    clauseRow(
      '13.2',
      'Endet der Hauptvertrag, endet auch diese Vereinbarung, unbeschadet fortwirkender Pflichten nach § 10 ' +
        '(Löschung und Rückgabe) und § 5 (Vertraulichkeit, die gemäß § 7.1 des Hauptvertrags für fünf Jahre ' +
        'nach Vertragsende fortgilt).'
    ),

    hinweisRow(
      'Hinweis: Diese Vorlage ist eine allgemeine, branchenspezifisch angepasste AVV nach Art. 28 DSGVO, keine ' +
        'Einzelfallberatung - vor produktivem Einsatz in einem neuen Anwendungsfall anwaltlich prüfen lassen.'
    ),
  ];

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  drawLetterhead(doc);
  const startY = drawHeaderBox(doc, { vertragsnummer, datum, kunde });

  autoTable(doc, buildAutoTableBody(doc, { startY, body }));

  drawSignatureBlock(doc, kunde.firma);
  drawFurniture(doc);
  return Buffer.from(doc.output('arraybuffer'));
}

// AVV-Baustein (Anlage 3): Vereinbarung zur Auftragsverarbeitung nach
// Art. 28 Abs. 3 DSGVO, für die DSGVO-Klausel-Varianten mit
// braucht_avv: true (siehe contractFields.js). Gleiches Grundprinzip wie
// contractDocx.js: fester Code, keine KI erzeugt hier Vertragstext. Struktur
// folgt der gesetzlichen Pflichtangaben-Liste aus Art. 28 Abs. 3 DSGVO.
//
// WICHTIG (wie bei § 7.2 des Hauptvertrags): Dies ist eine allgemeine
// Vorlage, keine Einzelfallberatung - vor produktivem Einsatz in einem neuen
// Anwendungsfall anwaltlich prüfen lassen.
import { Document, Packer, Paragraph, TextRun, Table, WidthType } from 'docx';
import { DSGVO_VARIANTEN, AVV_VARIANTEN, AUFTRAGNEHMER } from './contractFields.js';
import { heading, para, clause, bullet, formatDateDE, infoBoxRow, letterhead, footerNote, signatureBlock } from './docxHelpers.js';

export function buildAvvDocument(renderedData) {
  const { kunde = {}, vertragsnummer, datum, dsgvoVariante } = renderedData || {};
  const dsgvoInfo = DSGVO_VARIANTEN[dsgvoVariante];
  if (!dsgvoInfo || !dsgvoInfo.braucht_avv) {
    throw new Error(`Für die Datenschutz-Variante "${dsgvoVariante}" ist keine AVV erforderlich`);
  }
  const avvInfo = AVV_VARIANTEN[dsgvoVariante] || {
    kategorienBetroffenerPersonen: '[bitte ergänzen]',
    datenarten: '[bitte ergänzen]',
  };

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      infoBoxRow('Zu Vertrag', vertragsnummer),
      infoBoxRow('Datum', formatDateDE(datum)),
      infoBoxRow('Verantwortlicher (Auftraggeber)', kunde.firma),
      infoBoxRow('Auftragsverarbeiter', AUFTRAGNEHMER.firma),
    ],
  });

  const children = [
    ...letterhead(),
    new Paragraph({
      children: [
        new TextRun({ text: 'Anlage 3 — Vereinbarung zur Auftragsverarbeitung (AVV)', bold: true, size: 36 }),
      ],
      spacing: { after: 140 },
    }),
    para('gemäß Art. 28 DSGVO, Bestandteil des Reinigungsvertrags ' + (vertragsnummer || '[Vertragsnummer]')),
    headerTable,
    new Paragraph({ text: '', spacing: { after: 200 } }),

    heading('Gegenstand und Dauer der Verarbeitung', 1),
    clause(
      '1.1',
      'Gegenstand dieser Vereinbarung ist die Verarbeitung personenbezogener Daten, von denen der ' +
        'Auftragsverarbeiter im Rahmen der im Hauptvertrag beschriebenen Reinigungsleistungen zufällig ' +
        'Kenntnis erlangen kann.'
    ),
    clause(
      '1.2',
      'Die Dauer dieser Vereinbarung entspricht der Laufzeit des Hauptvertrags; sie endet nicht automatisch ' +
        'vor vollständiger Erfüllung der Pflichten aus § 10 (Löschung und Rückgabe).'
    ),

    heading('Art und Zweck der Verarbeitung', 2),
    clause(
      '2.1',
      'Eine gezielte, planmäßige Verarbeitung personenbezogener Daten ist nicht Gegenstand der Beauftragung. ' +
        'Der Auftragsverarbeiter erlangt ausschließlich zufällig, im Zuge der eigentlichen Reinigungsleistung, ' +
        'Kenntnis von personenbezogenen Daten (z.B. durch Sichtkontakt zu Unterlagen, Bildschirmen oder ' +
        'Datenträgern).'
    ),
    clause('2.2', 'Zweck der Verarbeitung ist ausschließlich die ordnungsgemäße Erbringung der vereinbarten Reinigungsleistung.'),

    heading('Art der Daten und Kategorien betroffener Personen', 3),
    bullet(`Kategorien betroffener Personen: ${avvInfo.kategorienBetroffenerPersonen}`),
    bullet(`Art der Daten: ${avvInfo.datenarten}`),

    heading('Weisungsgebundenheit', 4),
    clause(
      '4.1',
      'Der Auftragsverarbeiter verarbeitet personenbezogene Daten ausschließlich auf dokumentierte Weisung ' +
        'des Verantwortlichen (Art. 29, Art. 28 Abs. 3 lit. a DSGVO), es sei denn, er ist nach dem Recht der ' +
        'Union oder der Mitgliedstaaten zur Verarbeitung verpflichtet.'
    ),
    clause(
      '4.2',
      'Da die Verarbeitung nach § 2 auf zufällige Kenntnisnahme beschränkt ist, besteht die maßgebliche ' +
        'Weisung im Kern in der Einhaltung von § 5 (Vertraulichkeit) dieser Vereinbarung sowie der ' +
        'einschlägigen Klauseln des Hauptvertrags (insbesondere § 7 Datenschutz und Vertraulichkeit).'
    ),

    heading('Vertraulichkeit', 5),
    clause(
      '5.1',
      'Der Auftragsverarbeiter stellt sicher, dass sich alle zur Verarbeitung befugten Personen zur ' +
        'Vertraulichkeit verpflichtet haben (Art. 28 Abs. 3 lit. b, Art. 29, Art. 32 Abs. 4 DSGVO) oder einer ' +
        'angemessenen gesetzlichen Verschwiegenheitspflicht unterliegen, bevor sie erstmals eingesetzt werden.'
    ),

    heading('Technische und organisatorische Maßnahmen', 6),
    clause(
      '6.1',
      'Der Auftragsverarbeiter trifft die zur Gewährleistung eines dem Risiko angemessenen Schutzniveaus ' +
        'erforderlichen technischen und organisatorischen Maßnahmen gemäß Art. 32 DSGVO. Dazu zählen ' +
        'insbesondere: schriftliche Vertraulichkeitsverpflichtung des Personals vor Tätigkeitsbeginn (siehe ' +
        '§ 5), Anweisung, sichtbare Unterlagen/Bildschirminhalte/Datenträger weder zu lesen noch zu kopieren, ' +
        'zu fotografieren oder zu bewegen, sowie eine unverzügliche interne Meldekette bei erkannten ' +
        'Auffälligkeiten (siehe § 9).'
    ),
    clause(
      '6.2',
      'Der Auftragsverarbeiter weist die Umsetzung der Maßnahmen auf Verlangen des Verantwortlichen nach ' +
        '(siehe § 11).'
    ),

    heading('Unterauftragsverarbeiter', 7),
    clause(
      '7.1',
      'Setzt der Auftragsverarbeiter gemäß § 2.6 des Hauptvertrags Subunternehmer ein, gilt dies als ' +
        'allgemeine Genehmigung zur Beauftragung weiterer Auftragsverarbeiter im Sinne von Art. 28 Abs. 2 ' +
        'DSGVO. Der Auftragsverarbeiter informiert den Verantwortlichen über jede beabsichtigte Änderung in ' +
        'Bezug auf die Hinzuziehung oder Ersetzung solcher Subunternehmer, sodass der Verantwortliche ' +
        'ausreichend Zeit hat, gegen diese Änderungen Einspruch zu erheben.'
    ),
    clause(
      '7.2',
      'Der Auftragsverarbeiter verpflichtet eingesetzte Subunternehmer auf die gleichen Datenschutzpflichten, ' +
        'wie sie sich aus dieser Vereinbarung ergeben.'
    ),

    heading('Unterstützung bei der Wahrnehmung von Betroffenenrechten', 8),
    clause(
      '8.1',
      'Soweit möglich, unterstützt der Auftragsverarbeiter den Verantwortlichen mit geeigneten technischen ' +
        'und organisatorischen Maßnahmen bei der Erfüllung von dessen Pflicht zur Beantwortung von Anträgen ' +
        'auf Wahrnehmung der Betroffenenrechte (Art. 12 bis 22 DSGVO). Da der Auftragsverarbeiter selbst ' +
        'keine strukturierten personenbezogenen Daten des Verantwortlichen speichert (siehe § 2), beschränkt ' +
        'sich dies praktisch auf die unverzügliche Weiterleitung entsprechender Anfragen an den ' +
        'Verantwortlichen.'
    ),

    heading('Unterstützung bei Sicherheit der Verarbeitung und Meldepflichten', 9),
    clause(
      '9.1',
      'Stellt der Auftragsverarbeiter bei seiner Tätigkeit Anhaltspunkte für eine Verletzung des Schutzes ' +
        'personenbezogener Daten fest (z.B. offensichtlich unbefugten Zugriff Dritter auf Unterlagen oder ' +
        'IT-Systeme), informiert er den Verantwortlichen unverzüglich, spätestens innerhalb von 24 Stunden ' +
        'nach Kenntnisnahme (siehe bereits § 7 des Hauptvertrags), damit dieser seinen Melde- und ' +
        'Benachrichtigungspflichten nach Art. 33, 34 DSGVO nachkommen kann.'
    ),
    clause(
      '9.2',
      'Der Auftragsverarbeiter unterstützt den Verantwortlichen auf Anfrage bei der Erstellung von ' +
        'Datenschutz-Folgenabschätzungen (Art. 35 DSGVO), soweit die Verarbeitung durch den ' +
        'Auftragsverarbeiter davon betroffen ist.'
    ),

    heading('Löschung und Rückgabe', 10),
    clause(
      '10.1',
      'Der Auftragsverarbeiter verarbeitet und speichert im Rahmen seiner Tätigkeit grundsätzlich keine ' +
        'personenbezogenen Daten des Verantwortlichen in eigenen Systemen (siehe § 2). Sollten im Einzelfall ' +
        'dennoch Aufzeichnungen entstehen (z.B. Fotodokumentation eines Schadensfalls, die zufällig ' +
        'personenbezogene Daten enthält), löscht der Auftragsverarbeiter diese unverzüglich nach Wegfall des ' +
        'ursprünglichen Zwecks, spätestens mit Beendigung des Hauptvertrags, sofern keine gesetzliche ' +
        'Aufbewahrungspflicht entgegensteht.'
    ),

    heading('Kontrollrechte des Verantwortlichen', 11),
    clause(
      '11.1',
      'Der Verantwortliche hat das Recht, die Einhaltung der in dieser Vereinbarung festgelegten Pflichten ' +
        'beim Auftragsverarbeiter zu überprüfen bzw. durch beauftragte Dritte überprüfen zu lassen, ' +
        'insbesondere durch Einholung von Auskünften und Einsicht in die Nachweise über die Umsetzung der ' +
        'technischen und organisatorischen Maßnahmen (§ 6). Kontrollen vor Ort werden mit angemessenem ' +
        'zeitlichem Vorlauf (mindestens 5 Werktage) schriftlich angekündigt und finden während der üblichen ' +
        'Geschäftszeiten statt.'
    ),

    heading('Haftung', 12),
    clause(
      '12.1',
      'Für die Haftung gelten die Regelungen des Hauptvertrags (§ 5 Haftung und Versicherung) entsprechend, ' +
        'soweit diese Vereinbarung keine abweichenden Regelungen trifft. Zwingende gesetzliche ' +
        'Haftungsvorschriften der DSGVO (insbesondere Art. 82 DSGVO) bleiben unberührt.'
    ),

    heading('Schlussbestimmungen', 13),
    clause(
      '13.1',
      'Diese Vereinbarung ist Bestandteil des Hauptvertrags. Bei Widersprüchen zwischen dieser Vereinbarung ' +
        'und dem Hauptvertrag gehen die Regelungen dieser Vereinbarung in datenschutzrechtlichen Fragen vor.'
    ),
    clause(
      '13.2',
      'Endet der Hauptvertrag, endet auch diese Vereinbarung, unbeschadet fortwirkender Pflichten nach § 10 ' +
        '(Löschung und Rückgabe) und § 5 (Vertraulichkeit, die gemäß § 7.1 des Hauptvertrags für fünf Jahre ' +
        'nach Vertragsende fortgilt).'
    ),

    new Paragraph({ text: '', spacing: { before: 200, after: 200 } }),
    signatureBlock(kunde.firma),

    new Paragraph({ text: '', spacing: { before: 260 } }),
    new Paragraph({
      children: [
        new TextRun({
          text:
            'Hinweis: Diese Vorlage ist eine allgemeine, branchenspezifisch angepasste AVV nach Art. 28 ' +
            'DSGVO, keine Einzelfallberatung - vor produktivem Einsatz in einem neuen Anwendungsfall ' +
            'anwaltlich prüfen lassen.',
          italics: true,
          size: 16,
          color: '6B7280',
        }),
      ],
    }),
    footerNote(),
  ];

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

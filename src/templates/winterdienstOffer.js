// Winterdienst-Angebot zum direkten Unterschreiben durch den Kunden.
//
// Seit 02.10.2026 (AN-1363/AN-1364): Winterdienst-Angebote sind gleichzeitig
// der Vertrag. Der Kunde unterschreibt die "Auftragserteilung" am Ende, damit
// ist der Vertrag geschlossen - kein separater Vertrag, keine Unterschrift von
// Clean Connect (das Angebot ist ohne Unterschrift gültig, Schriftform ist
// für Winterdienst nicht vorgeschrieben).
//
// Rechtliche Eckpunkte, die hier bewusst fest im Text stehen und nicht im
// Formular änderbar sind:
// - Einsatzzeiten 07-20 Uhr werktags, 09-20 Uhr Sonn-/Feiertage, kommunale
//   Satzung geht vor. Die alten Angebote sagten "unabhängig von der
//   Tageszeit" - das war eine 24-Stunden-Haftung.
// - Keine automatische Verlängerung: Eigentümergemeinschaften gelten nach
//   BGH als Verbraucher, sobald ein Eigentümer Verbraucher ist; eine stille
//   Verlängerung um eine ganze Saison wäre dann nach § 309 Nr. 9 BGB
//   unwirksam.
// - Widerrufsbelehrung + Muster-Formular für Verbraucher/WEG, sonst kann bis
//   zu 12 Monate + 14 Tage widerrufen werden.
// - Haftung nach § 309 Nr. 7 BGB (Leben/Körper/Gesundheit, Vorsatz, grobe
//   Fahrlässigkeit unbeschränkt).
//
// sevDesk rendert Kopf-/Fußtext als HTML (PDFreactor). "page-break-before"
// funktioniert dort - damit landet jeder Abschnitt auf einer eigenen Seite
// statt wie früher quer über die Seiten verteilt. Die Positionstexte sind
// absichtlich einzeilig, sonst rutschen die Summen von Seite 1 auf Seite 2.

export const AUFTRAGGEBER_ARTEN = {
  weg: { label: 'Eigentümergemeinschaft (WEG)', widerruf: true },
  eigentuemer: { label: 'Eigentümer (privat)', widerruf: true },
  firma: { label: 'Firma / Gewerbe', widerruf: false },
};

export const DEFAULT_FLAECHE =
  'Gehweg entlang der Grundstücksfront {objekt}, in der nach der Straßenreinigungssatzung der {stadt} räum- und streupflichtigen Breite, wie bei der Objektbesichtigung festgelegt.';

export const DEFAULT_DECKUNGSSUMME = '1.000.000';

const MONATE = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];
const PAGE_BREAK = '<div style="page-break-before: always;"></div>';
const LINE = '_'.repeat(38);

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formatDateDE(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

// Anzahl Saisonmonate, Start- und Endmonat jeweils mitgezählt
// (01.11. bis 31.03. = 5).
export function saisonMonate(startIso, endeIso) {
  if (!startIso || !endeIso) return 0;
  const [sy, sm] = startIso.split('-').map(Number);
  const [ey, em] = endeIso.split('-').map(Number);
  return Math.max(0, (ey - sy) * 12 + (em - sm) + 1);
}

function monatJahr(iso) {
  const [y, m] = iso.split('-').map(Number);
  return `${MONATE[m - 1]} ${y}`;
}

// "Köln" -> "Stadt Köln"; wer schon "Gemeinde ..." o. ä. einträgt, bekommt es unverändert.
export function satzungsgeber(stadt) {
  const s = (stadt || '').trim();
  if (!s) return 'jeweiligen Gemeinde';
  return /^(stadt|gemeinde)\s/i.test(s) ? s : `Stadt ${s}`;
}

const p = (html) => `<p>${html}</p>`;
const h2 = (t) => p(`<b style="font-size: 1.15em;">${t}</b>`);
const h3 = (t) => p(`<b>${t}</b>`);

/**
 * Baut alle Texte und Positionen eines Winterdienst-Angebots.
 *
 * input:
 *   offerNumber, offerDate (ISO), gueltigBis (ISO)
 *   saisonStart, saisonEnde (ISO)
 *   objekt          z. B. "Im Dickten 24, 42281 Wuppertal"
 *   stadt           z. B. "Wuppertal" (für die Straßenreinigungssatzung)
 *   art             'weg' | 'eigentuemer' | 'firma'
 *   auftraggeber    z. B. "Gemeinschaft der Wohnungseigentümer Im Dickten 24, 42281 Wuppertal"
 *   vertreter       optional { name, street, zipCity } (Hausverwaltung)
 *   rechnungsanschrift optional { street, zipCity } (nur ohne Vertreter)
 *   flaeche         optional, Freitext; {objekt}/{stadt} werden ersetzt
 *   preise          { bereitschaft, streuen, raeumen } netto
 *   zuschlagProzent Sonn-/Feiertagszuschlag, Standard 100
 *   widerruf        optional bool, Standard aus der Auftraggeber-Art
 *   deckungssumme   optional, Standard "1.000.000"
 */
export function buildWinterdienstOffer(input) {
  const {
    offerNumber,
    offerDate,
    gueltigBis,
    saisonStart,
    saisonEnde,
    objekt,
    stadt,
    art = 'weg',
    auftraggeber,
    vertreter,
    rechnungsanschrift,
    flaeche,
    preise = {},
    zuschlagProzent = 100,
    deckungssumme = DEFAULT_DECKUNGSSUMME,
  } = input;
  const widerruf = input.widerruf ?? AUFTRAGGEBER_ARTEN[art]?.widerruf ?? true;
  const monate = saisonMonate(saisonStart, saisonEnde);
  const saison = `${formatDateDE(saisonStart)} bis ${formatDateDE(saisonEnde)}`;
  const satzung = satzungsgeber(stadt);
  const flaecheText = (flaeche || DEFAULT_FLAECHE).replaceAll('{objekt}', objekt || '').replaceAll('{stadt}', satzung);
  const vertretenDurch = vertreter?.name
    ? `, vertreten durch ${esc([vertreter.name, vertreter.street, vertreter.zipCity].filter(Boolean).join(', '))}`
    : '';

  const headText = [
    p('Sehr geehrte Damen und Herren,'),
    p(
      `vielen Dank für Ihre Anfrage. Gerne bieten wir Ihnen den Winterdienst für die Liegenschaft <b>${esc(objekt)}</b> für die Saison vom <b>${saison}</b> an.`
    ),
    p(
      `<b>So beauftragen Sie uns:</b> Unterschreiben Sie die <b>Auftragserteilung</b> am Ende dieses Angebots und senden Sie das vollständige Angebot bis zum <b>${formatDateDE(gueltigBis)}</b> per E-Mail (Scan oder Foto genügt) an service@reinigungsdienst-cleanconnect.de oder per Post an uns zurück. Mit Ihrer Unterschrift kommt der Vertrag zustande, ein gesonderter Vertrag ist nicht erforderlich. Sie erhalten anschließend eine Auftragsbestätigung.`
    ),
  ].join('');

  const widerrufCheckbox = widerruf
    ? p(
        '☐ Nur bei Widerrufsrecht: Wir verlangen ausdrücklich, dass der Winterdienst bereits vor Ablauf der Widerrufsfrist beginnt, und wissen, dass wir bei einem Widerruf die bis dahin erbrachten Leistungen anteilig bezahlen.'
      ) + '<p><br></p>'
    : '';

  const footParts = [
    p(
      `<b>Erläuterung zu den Preisen:</b> Die Bereitschaftspauschale (Pos. 1) wird für jeden Saisonmonat von ${monatJahr(saisonStart).split(' ')[0]} bis ${monatJahr(saisonEnde).split(' ')[0]} berechnet, auch wenn kein Einsatz erforderlich ist. Die Positionen 2 und 3 sind <b>Preise je Einsatz</b> und werden nach tatsächlich erbrachten Einsätzen abgerechnet; je Einsatz wird nur eine der beiden Positionen berechnet. Sie sind daher als optionale Positionen ausgewiesen und nicht im Gesamtbetrag enthalten. Für Einsätze an Sonntagen und gesetzlichen Feiertagen in NRW gilt ein Zuschlag von ${zuschlagProzent} % auf den Einsatzpreis. Alle Preise zzgl. gesetzlicher Umsatzsteuer (derzeit 19 %).`
    ),
    PAGE_BREAK,
    h2('1. Leistungsbeschreibung'),
    h3('1.1 Vertragsfläche'),
    p(
      `${esc(flaecheText)} Andere Flächen (z. B. Zuwege, Hauseingänge, Stellplätze, Treppen) gehören nur dann zum Vertrag, wenn sie hier ausdrücklich genannt sind.`
    ),
    h3('1.2 Leistungen'),
    '<ul><li>Räumen von Schnee und Streuen mit abstumpfenden Mitteln (Granulat, Splitt oder Sand) bei Schneefall und Glätte</li><li>Kontrolle der Vertragsfläche und Nachstreuen nach Bedarf innerhalb der Einsatzzeiten</li><li>auftauende Mittel (z. B. Streusalz) nur, soweit die kommunalen Vorschriften dies zulassen (z. B. bei Eisregen)</li><li>Dokumentation jedes Einsatzes mit Datum, Uhrzeit und Art der Leistung</li></ul>',
    h3('1.3 Einsatzzeiten'),
    p(
      'Der Winterdienst wird so durchgeführt, dass die Vertragsfläche während folgender Zeiten gesichert ist:<br><b>Werktags (Montag bis Samstag): 07:00 bis 20:00 Uhr</b><br><b>Sonntags und an gesetzlichen Feiertagen: 09:00 bis 20:00 Uhr</b>'
    ),
    p(
      `Schnee und Glätte, die über Nacht entstehen, werden bis zum Beginn dieser Zeiten beseitigt. Tritt Schneefall oder Glätte innerhalb dieser Zeiten auf, erfolgt der Einsatz innerhalb von 60 Minuten nach Feststellung durch uns oder Meldung durch Sie; bei anhaltendem Schneefall wird in angemessenen Abständen wiederholt geräumt und gestreut. Schreibt die jeweils gültige Straßenreinigungssatzung der ${esc(satzung)} andere Zeiten vor, gelten diese. Außerhalb der Einsatzzeiten besteht keine Räum- und Streupflicht.`
    ),
    h3('1.4 Einsatzentscheidung'),
    p(
      'Wir entscheiden eigenständig, ohne dass es Ihrer Aufforderung bedarf, über Notwendigkeit, Zeitpunkt und Art des Einsatzes anhand der Wetterlage, der Wetterprognosen und der Verhältnisse vor Ort. Ein Einsatz erfolgt insbesondere bei Schneefall sowie bei Temperaturen um oder unter 0 °C mit Glättegefahr (z. B. Reif, überfrierende Nässe, Eisregen).'
    ),
    h3('1.5 Übernahme der Verkehrssicherungspflicht'),
    p(
      'Mit Vertragsbeginn übernehmen wir für die Vertragsfläche und innerhalb der Einsatzzeiten die Räum- und Streupflicht einschließlich der damit verbundenen Verkehrssicherungspflicht. Ihnen verbleibt die Pflicht, die ordnungsgemäße Durchführung stichprobenartig zu überwachen; erkennbare Mängel teilen Sie uns bitte unverzüglich mit.'
    ),
    h3('1.6 Dokumentation'),
    p(
      'Jeder Einsatz wird mit Datum, Uhrzeit und Art der Leistung dokumentiert. Die Einsatznachweise erhalten Sie mit der monatlichen Rechnung; im Schadensfall stellen wir sie Ihnen jederzeit zur Verfügung.'
    ),
    PAGE_BREAK,
    h2('2. Vertragsbedingungen'),
    h3('2.1 Laufzeit'),
    p(
      `Der Vertrag beginnt am ${formatDateDE(saisonStart)} und endet am ${formatDateDE(saisonEnde)}, ohne dass es einer Kündigung bedarf. Eine ordentliche Kündigung während der Saison ist ausgeschlossen. Das Recht zur außerordentlichen Kündigung aus wichtigem Grund (§ 314 BGB) bleibt unberührt. Für die Folgesaison senden wir Ihnen rechtzeitig ein neues Angebot.`
    ),
    h3('2.2 Abrechnung und Zahlung'),
    p(
      'Wir rechnen monatlich nachträglich ab: Bereitschaftspauschale und die im Abrechnungsmonat erbrachten Einsätze, jeweils mit Einsatznachweis. Rechnungen sind innerhalb von 14 Tagen nach Rechnungsdatum ohne Abzug zahlbar.'
    ),
    h3('2.3 Mitwirkung des Auftraggebers'),
    p(
      'Sie sorgen, soweit dies in Ihrem Einflussbereich liegt, dafür, dass die Vertragsfläche frei von Hindernissen ist (z. B. Mülltonnen, abgestellte Gegenstände) und uns Änderungen an der Fläche oder neu entstandene Gefahrenstellen (z. B. Baustellen, beschädigter Belag) mitgeteilt werden. Kann eine Teilfläche wegen eines solchen Hindernisses nicht bearbeitet werden, informieren wir Sie; für diese Teilfläche geht die Verkehrssicherungspflicht für die Dauer der Behinderung nicht auf uns über.'
    ),
    h3('2.4 Haftung und Versicherung'),
    p(
      `a) Wir haften unbeschränkt für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit sowie für Schäden, die auf Vorsatz oder grober Fahrlässigkeit beruhen.<br>b) Bei leichter Fahrlässigkeit haften wir nur bei Verletzung einer wesentlichen Vertragspflicht, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung Sie regelmäßig vertrauen dürfen; die Haftung ist dann auf den vorhersehbaren, vertragstypischen Schaden begrenzt.<br>c) Wir haften nicht für Flächen, die nicht Vertragsfläche sind, und nicht außerhalb der Einsatzzeiten nach Ziffer 1.3.<br>d) Wir unterhalten für die Dauer des Vertrags eine Betriebshaftpflichtversicherung mit einer Deckungssumme von mindestens ${esc(deckungssumme)} € je Schadensfall, die Personen- und Sachschäden aus dem Winterdienst abdeckt. Einen Versicherungsnachweis erhalten Sie auf Anfrage.`
    ),
    h3('2.5 Höhere Gewalt'),
    p(
      'Machen außergewöhnliche Witterungsereignisse (z. B. Unwetter mit flächendeckenden Verkehrsbehinderungen) oder andere Fälle höherer Gewalt eine fristgerechte Leistung objektiv unmöglich, ruht die Leistungspflicht für die Dauer der Behinderung. Wir informieren Sie in diesem Fall unverzüglich, damit Sie eigene Sicherungsmaßnahmen treffen können.'
    ),
    h3('2.6 Beanstandungen'),
    p(
      'Bitte melden Sie Beanstandungen möglichst unverzüglich, spätestens innerhalb von 3 Werktagen nach dem Einsatz, in Textform (z. B. per E-Mail), damit wir sie vor Ort prüfen und abstellen können. Ihre gesetzlichen Rechte bleiben unberührt.'
    ),
    h3('2.7 Schlussbestimmungen'),
    p(
      'Änderungen und Ergänzungen dieses Vertrags bedürfen der Textform. Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt. Es gilt deutsches Recht. Gerichtsstand ist Köln, soweit dies gesetzlich zulässig vereinbart werden kann.'
    ),
    PAGE_BREAK,
    h2('3. Auftragserteilung'),
    p(
      `Hiermit erteilt der Auftraggeber, <b>${esc(auftraggeber)}</b>${vertretenDurch}, der Clean Connect Gebäudereinigung UG (haftungsbeschränkt), Berliner Straße 957, 51069 Köln, den Auftrag für den Winterdienst für die Saison ${saison} zu den Preisen und Bedingungen des <b>Angebots ${esc(offerNumber)} vom ${formatDateDE(offerDate)}</b>.`
    ),
    '<p><br></p>',
    p(`${LINE}<br>Name in Druckbuchstaben`),
    '<p><br></p>',
    p(`${LINE}<br>Funktion (z. B. Verwalter/in, Prokurist/in)`),
    '<p><br></p>',
    p(`${LINE}<br>E-Mail für Rechnungen und Einsatznachweise`),
    '<p><br></p>',
    p(`${LINE}<br>Ansprechpartner vor Ort (Name, Telefon), z. B. Hausmeister`),
    '<p><br></p>',
    widerrufCheckbox,
    '<p><br></p>',
    p(`${LINE}<br>Ort, Datum`),
    '<p><br></p><p><br></p>',
    p(`${LINE}<br><b>Unterschrift und Stempel Auftraggeber</b>`),
    '<p><br></p><p><br></p>',
    p(
      '<i>Dieses Angebot wurde elektronisch erstellt und ist ohne Unterschrift gültig. Clean Connect Gebäudereinigung UG (haftungsbeschränkt), vertreten durch den Geschäftsführer Fynn Laubkermeier.</i>'
    ),
  ];

  if (widerruf) {
    footParts.push(
      PAGE_BREAK,
      h2('4. Widerrufsbelehrung'),
      p(
        '<i>Gilt nur, wenn der Auftraggeber Verbraucher ist. Eine Gemeinschaft der Wohnungseigentümer wird nach der Rechtsprechung des BGH wie ein Verbraucher behandelt, wenn ihr mindestens ein Verbraucher angehört.</i>'
      ),
      h3('Widerrufsrecht'),
      p(
        'Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.'
      ),
      p(
        'Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (Clean Connect Gebäudereinigung UG (haftungsbeschränkt), Berliner Straße 957, 51069 Köln, Telefon +49 221 95490625, E-Mail service@reinigungsdienst-cleanconnect.de) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.'
      ),
      p(
        'Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.'
      ),
      h3('Folgen des Widerrufs'),
      p(
        'Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.'
      ),
      p(
        'Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen sollen, so haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem Sie uns von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags unterrichten, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht.'
      ),
      h3('Muster-Widerrufsformular'),
      p('(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)'),
      p(
        'An Clean Connect Gebäudereinigung UG (haftungsbeschränkt), Berliner Straße 957, 51069 Köln, E-Mail service@reinigungsdienst-cleanconnect.de:'
      ),
      p(
        'Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*)/die Erbringung der folgenden Dienstleistung (*)'
      ),
      p(
        `${LINE}${LINE}<br><br>Bestellt am (*)/erhalten am (*): ${LINE}<br><br>Name des/der Verbraucher(s): ${LINE}<br><br>Anschrift des/der Verbraucher(s): ${LINE}<br><br>Unterschrift (nur bei Mitteilung auf Papier): ${LINE}<br><br>Datum: ${LINE}`
      ),
      p('(*) Unzutreffendes streichen.')
    );
  }

  const zeitraum = `Saison ${monatJahr(saisonStart)} bis ${monatJahr(saisonEnde)} (${monate} Monate)`;
  const positions = [
    { name: 'Bereitschaftspauschale je Monat', text: zeitraum, quantity: monate, price: Number(preise.bereitschaft) || 0, unity: '37', optional: false },
    { name: 'Streuen – je Einsatz', text: 'bei Glätte, inkl. Streumittel', quantity: 1, price: Number(preise.streuen) || 0, unity: '7', optional: true },
    { name: 'Räumen & Streuen – je Einsatz', text: 'bei Schneefall, inkl. Streumittel', quantity: 1, price: Number(preise.raeumen) || 0, unity: '7', optional: true },
  ];

  const anschrift = vertreter?.name ? vertreter : rechnungsanschrift || {};
  const address = [
    auftraggeber,
    vertreter?.name ? `vertreten durch ${vertreter.name}` : null,
    anschrift.street,
    anschrift.zipCity,
  ]
    .filter((l) => l && String(l).trim())
    .join('\n');

  const objektKurz = (objekt || '').split(',')[0].trim();
  const ort = (stadt || '').trim();
  return {
    header: `Angebot ${offerNumber} – Winterdienst ${[objektKurz, ort].filter(Boolean).join(', ')}`,
    headText,
    footText: footParts.join(''),
    positions,
    address,
    addressName: vertreter?.name || auftraggeber || '',
    summeNetto: Math.round(monate * (Number(preise.bereitschaft) || 0) * 100) / 100,
  };
}

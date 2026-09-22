// Textbausteine für das sevDesk-Angebot, je nach Art des Kunden.
//
// Bis 2026-09-22 gab es genau einen Satz Standardtexte für jedes Angebot -
// vom Einzelbüro bis zur Hausverwaltung. Die Varianten hier unterscheiden
// sich nur dort, wo es fachlich einen Unterschied macht: wer angesprochen
// wird, was im Preis enthalten ist und wie der Vertrag zustande kommt.
//
// Alles bleibt im Modal frei editierbar - das sind Startpunkte, keine
// festen Texte. Preise und Zahlen stehen bewusst in keinem Baustein.

const STANDARD = {
  label: 'Standard (Büro, Gewerbe)',
  anrede: 'Sehr geehrte Damen und Herren,',
  einleitung:
    'im Folgenden erhalten Sie unser unverbindliches Angebot zur Reinigung Ihrer Räumlichkeiten. Dieses ist auf Ihre Anforderungen abgestimmt und kann nach Absprache jederzeit angepasst werden.',
  hinweis:
    'Reinigungsmaterialien, Wasseraufbereitung und die Anfahrt sind im Preis enthalten. Die Begehung und Flächenaufnahme erfolgt im Rahmen der Objektbesichtigung.',
  vertragstext:
    'Vertragsunterzeichnung: Nach Auftragserteilung erhalten Sie den Vertrag separat zur Prüfung und Unterzeichnung.',
  dankText:
    'Wir danken Ihnen für Ihr Vertrauen und freuen uns auf eine erfolgreiche Zusammenarbeit.\n\nFür Rückfragen stehen wir Ihnen jederzeit gerne zur Verfügung.',
  grussformel: 'Mit freundlichen Grüßen\n\nIhr Clean Connect Team',
};

export const OFFER_TEXT_VARIANTS = {
  standard: STANDARD,

  praxis: {
    ...STANDARD,
    label: 'Arztpraxis / Therapie',
    einleitung:
      'im Folgenden erhalten Sie unser unverbindliches Angebot zur Unterhaltsreinigung Ihrer Praxisräume. Der Leistungsumfang ist auf den laufenden Praxisbetrieb abgestimmt und kann nach Absprache jederzeit angepasst werden.',
    hinweis:
      'Reinigungsmaterialien, Wasseraufbereitung und die Anfahrt sind im Preis enthalten. Die Reinigung erfolgt außerhalb Ihrer Sprechzeiten. Behandlungsflächen und Medizinprodukte werden nicht bearbeitet; deren hygienische Aufbereitung verbleibt bei Ihnen. Die Begehung und Flächenaufnahme erfolgt im Rahmen der Objektbesichtigung.',
    vertragstext:
      'Vertragsunterzeichnung: Nach Auftragserteilung erhalten Sie den Vertrag sowie die Vereinbarung zur Auftragsverarbeitung separat zur Prüfung und Unterzeichnung. Unsere Mitarbeitenden sind zur Verschwiegenheit verpflichtet.',
  },

  hausverwaltung: {
    ...STANDARD,
    label: 'Wohnanlage / Hausverwaltung',
    einleitung:
      'im Folgenden erhalten Sie unser unverbindliches Angebot für die Treppenhaus- und Allgemeinflächenreinigung der genannten Liegenschaft. Der Leistungsumfang ist auf die Anforderungen der Hausverwaltung abgestimmt und kann nach Absprache jederzeit angepasst werden.',
    hinweis:
      'Reinigungsmaterialien, Wasseraufbereitung und die Anfahrt sind im Preis enthalten. Festgestellte Mängel, Beschädigungen und ordnungswidrige Ablagerungen werden der Hausverwaltung gemeldet. Privates Eigentum der Bewohner wird nicht bewegt oder entsorgt. Die Begehung und Flächenaufnahme erfolgt im Rahmen der Objektbesichtigung.',
    vertragstext:
      'Vertragsunterzeichnung: Nach Auftragserteilung erhalten Sie den Vertrag separat zur Prüfung und Unterzeichnung. Entrümpelungen und Sonderleistungen werden erst nach ausdrücklicher Beauftragung durch die Hausverwaltung ausgeführt.',
  },

  kita: {
    ...STANDARD,
    label: 'Kita / Betreuung',
    einleitung:
      'im Folgenden erhalten Sie unser unverbindliches Angebot zur Unterhaltsreinigung Ihrer Einrichtung. Der Leistungsumfang ist auf den Betreuungsbetrieb abgestimmt und kann nach Absprache jederzeit angepasst werden.',
    hinweis:
      'Reinigungsmaterialien, Wasseraufbereitung und die Anfahrt sind im Preis enthalten. Die Reinigung erfolgt außerhalb der Betreuungszeiten. Spielzeug und pädagogisches Material werden nicht gereinigt oder umgeräumt. Die Begehung und Flächenaufnahme erfolgt im Rahmen der Objektbesichtigung.',
    vertragstext:
      'Vertragsunterzeichnung: Nach Auftragserteilung erhalten Sie den Vertrag separat zur Prüfung und Unterzeichnung. Unsere Mitarbeitenden legen auf Wunsch ein erweitertes Führungszeugnis vor.',
  },

  einzelleistung: {
    ...STANDARD,
    label: 'Einzelleistung (Glas, Grund, Sonder)',
    einleitung:
      'im Folgenden erhalten Sie unser unverbindliches Angebot für die angefragte Einzelleistung. Der Leistungsumfang ist im beiliegenden Leistungsverzeichnis beschrieben und kann nach Absprache jederzeit angepasst werden.',
    hinweis:
      'Reinigungsmaterialien, Wasseraufbereitung und die Anfahrt sind im Preis enthalten. Die Ausführung erfolgt nach Terminabsprache. Nicht erreichbare oder fest verbaute Flächen sind nicht enthalten.',
    vertragstext:
      'Auftragserteilung: Eine Beauftragung ist formlos möglich. Der Termin wird nach Auftragserteilung gemeinsam abgestimmt.',
  },
};

export const OFFER_TEXT_ORDER = ['standard', 'praxis', 'hausverwaltung', 'kita', 'einzelleistung'];

// Rät die passende Variante aus dem LV-Titel und den Bereichsnamen, damit im
// Regelfall schon das Richtige vorausgewählt ist. Im Zweifel: Standard.
export function guessOfferVariant({ lvTitle, sections } = {}) {
  const haystack = [lvTitle || '', ...(sections || []).map((s) => s.title || '')]
    .join(' ')
    .toLowerCase();
  if (/behandlungs|praxis|therapie|physio|arzt|zahn/.test(haystack)) return 'praxis';
  if (/hausmeister|treppenhaus|keller und waschraum|eingangsbereich|wohnanlage/.test(haystack)) {
    return 'hausverwaltung';
  }
  if (/kinder|gruppen|kita|betreuung/.test(haystack)) return 'kita';
  if (/glasreinigung|grundreinigung|winterdienst/.test(lvTitle || '')) return 'einzelleistung';
  return 'standard';
}

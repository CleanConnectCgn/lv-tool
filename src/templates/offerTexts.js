// Textbausteine für das sevDesk-Angebot, je nach Art des Kunden.
//
// Bis 2026-09-22 gab es genau einen Satz Standardtexte für jedes Angebot -
// vom Einzelbüro bis zur Hausverwaltung. Die Varianten hier unterscheiden
// sich nur dort, wo es fachlich einen Unterschied macht: wer angesprochen
// wird, was im Preis enthalten ist und wie der Vertrag zustande kommt.
//
// Alles bleibt im Modal frei editierbar - das sind Startpunkte, keine
// festen Texte. Preise und Zahlen stehen bewusst in keinem Baustein.
//
// Seit 25.09.2026: "einzelleistung" als ein Sammeltopf fuer Glas-, Grund-
// und Sonderreinigung reichte nicht - die drei sind fachlich zu
// unterschiedlich (Glas ist wiederkehrend, Grund und Sonder sind meist
// einmalig; was "im Preis enthalten" heisst, unterscheidet sich). Jede hat
// jetzt einen eigenen Text. "kuendigungsfristStandard" sagt, ob die
// Kuendigungsfrist-Zeile im Fusstext standardmaessig an ist: an fuer
// laufende Vertraege (Unterhaltsreinigung, Glas im Abo), aus fuer einmalige
// Auftraege (Grund-/Sonderreinigung) - dort gibt es keinen laufenden
// Vertrag, der gekuendigt werden koennte. Bleibt im Modal ueberschreibbar.

const STANDARD = {
  label: 'Standard (Büro, Gewerbe)',
  kuendigungsfristStandard: true,
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

  glasreinigung: {
    ...STANDARD,
    label: 'Glasreinigung',
    // Meist als wiederkehrendes Abo angefragt (z.B. "alle 3 Monate") - eine
    // laufende Vertragsbeziehung, deshalb bleibt die Kuendigungsfrist an.
    kuendigungsfristStandard: true,
    einleitung:
      'im Folgenden erhalten Sie unser unverbindliches Angebot zur Reinigung Ihrer Glasflächen. Der Leistungsumfang ist im beiliegenden Leistungsverzeichnis beschrieben und kann nach Absprache jederzeit angepasst werden.',
    hinweis:
      'Reinigungsmaterialien, Wasseraufbereitung und die Anfahrt sind im Preis enthalten. Gereinigt werden die im Leistungsverzeichnis genannten Glasflächen von innen und außen, soweit ohne Hebebühne oder Absturzsicherung erreichbar. Fest verbaute oder blickdichte Verglasungen sind ausgenommen.',
    vertragstext:
      'Vertragsunterzeichnung: Nach Auftragserteilung erhalten Sie den Vertrag separat zur Prüfung und Unterzeichnung.',
  },

  grundreinigung: {
    ...STANDARD,
    label: 'Grundreinigung',
    // Einmaliger Auftrag ohne laufenden Vertrag - keine Kuendigungsfrist.
    kuendigungsfristStandard: false,
    einleitung:
      'im Folgenden erhalten Sie unser unverbindliches Angebot für eine einmalige Grundreinigung. Der Leistungsumfang ist im beiliegenden Leistungsverzeichnis beschrieben und kann nach Absprache jederzeit angepasst werden.',
    hinweis:
      'Reinigungsmaterialien, Wasseraufbereitung und die Anfahrt sind im Preis enthalten. Die Ausführung erfolgt nach Terminabsprache außerhalb des laufenden Betriebs, sofern möglich. Stark anhaftende Verschmutzungen (z. B. eingebrannte Rückstände, Farbreste) sind nicht in jedem Fall vollständig entfernbar und werden vor Ort besprochen.',
    vertragstext:
      'Auftragserteilung: Eine Beauftragung ist formlos möglich. Der Termin wird nach Auftragserteilung gemeinsam abgestimmt.',
  },

  sonderreinigung: {
    ...STANDARD,
    label: 'Sonderreinigung (Teppich, Polster, u. a.)',
    kuendigungsfristStandard: false,
    einleitung:
      'im Folgenden erhalten Sie unser unverbindliches Angebot für die angefragte Sonderreinigung. Der Leistungsumfang ist im beiliegenden Leistungsverzeichnis beschrieben und kann nach Absprache jederzeit angepasst werden.',
    hinweis:
      'Reinigungsmaterialien, Wasseraufbereitung und die Anfahrt sind im Preis enthalten. Die Ausführung erfolgt nach Terminabsprache. Bei stark beanspruchten oder vorgeschädigten Materialien (z. B. Teppich, Polster) kann eine vollständige Fleckenfreiheit nicht garantiert werden.',
    vertragstext:
      'Auftragserteilung: Eine Beauftragung ist formlos möglich. Der Termin wird nach Auftragserteilung gemeinsam abgestimmt.',
  },
};

export const OFFER_TEXT_ORDER = [
  'standard',
  'praxis',
  'hausverwaltung',
  'kita',
  'glasreinigung',
  'grundreinigung',
  'sonderreinigung',
];

// Rät die passende Variante aus dem LV-Titel und den Bereichsnamen, damit im
// Regelfall schon das Richtige vorausgewählt ist. Im Zweifel: Standard.
export function guessOfferVariant({ lvTitle, sections } = {}) {
  const titel = (lvTitle || '').toLowerCase();
  const haystack = [lvTitle || '', ...(sections || []).map((s) => s.title || '')]
    .join(' ')
    .toLowerCase();
  if (/behandlungs|praxis|therapie|physio|arzt|zahn/.test(haystack)) return 'praxis';
  if (/hausmeister|treppenhaus|keller und waschraum|eingangsbereich|wohnanlage/.test(haystack)) {
    return 'hausverwaltung';
  }
  if (/kinder|gruppen|kita|betreuung/.test(haystack)) return 'kita';
  if (/glasreinigung/.test(titel)) return 'glasreinigung';
  if (/grundreinigung/.test(titel)) return 'grundreinigung';
  if (/teppich|polster|sonderreinigung|winterdienst/.test(titel)) return 'sonderreinigung';
  return 'standard';
}

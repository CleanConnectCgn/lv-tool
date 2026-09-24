// Erkennt aus einem frei gesprochenen/getippten Text, welche Einzelleistung
// gemeint ist (Glasreinigung, Grundreinigung oder eine sonstige Leistung mit
// eigenem Titel).
//
// Bewusst ohne KI-Aufruf: bei nur drei möglichen Ergebnissen ist eine
// einfache Stichwortsuche genauso zuverlässig wie ein Modellaufruf, aber
// sofort, kostenlos und unabhängig davon, ob Gemini gerade erreichbar ist.

// Wörter, die eindeutig auf Glas- bzw. Grundreinigung hindeuten. Kommt eines
// davon vor, ist die Sache klar - ein "Fensterputzer, der auch mal Böden
// grundreinigt" wäre die seltene Ausnahme, für die es weiterhin die manuelle
// Auswahl gibt.
const GLAS_STICHWORTE = ['glas', 'fenster', 'scheibe'];
const GRUND_STICHWORTE = ['grundreinigung', 'grundreinigen'];

// Häufige Einzelleistungen, deren Namen selbst als Titel taugen, wenn sie im
// Text vorkommen ("Teppichreinigung", "Bauendreinigung", ...). Nicht
// abschließend - kommt keine davon vor, bleibt der Titel leer und die Person
// trägt ihn selbst ein.
const BEKANNTE_SONSTIGE_LEISTUNGEN = [
  'Teppichreinigung',
  'Bauendreinigung',
  'Baureinigung',
  'Fassadenreinigung',
  'Polsterreinigung',
  'Dachrinnenreinigung',
  'Graffitientfernung',
  'Entrümpelung',
  'Winterdienst',
];

function enthaeltStichwort(textKlein, stichworte) {
  return stichworte.some((s) => textKlein.includes(s));
}

/**
 * @param {string} text  frei formulierte Beschreibung, z.B. aus Diktat oder Eingabe
 * @returns {{ serviceKey: 'glasreinigung'|'grundreinigung'|'sonstiges', customTitle: string, erkannt: boolean }}
 */
export function guessSingleService(text) {
  const klein = (text || '').toLowerCase();

  if (enthaeltStichwort(klein, GLAS_STICHWORTE)) {
    return { serviceKey: 'glasreinigung', customTitle: '', erkannt: true };
  }
  if (enthaeltStichwort(klein, GRUND_STICHWORTE)) {
    return { serviceKey: 'grundreinigung', customTitle: '', erkannt: true };
  }

  const treffer = BEKANNTE_SONSTIGE_LEISTUNGEN.find((leistung) => klein.includes(leistung.toLowerCase()));
  if (treffer) {
    return { serviceKey: 'sonstiges', customTitle: treffer, erkannt: true };
  }

  return { serviceKey: 'sonstiges', customTitle: '', erkannt: false };
}

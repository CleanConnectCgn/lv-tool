// Nachschlagewerk für die Autovervollständigung im Zeileneditor.
//
// Die Liste ist nicht ausgedacht, sondern aus den tatsächlich ausgelieferten
// Leistungsverzeichnissen gezogen und nach Häufigkeit sortiert (siehe
// LEARNINGS-2026-09-22.md). Zu vielen Einträgen liegt in TASK_DESCRIPTIONS
// die ausformulierte Leistungsbeschreibung, die beim Übernehmen eines
// Vorschlags gleich mit gesetzt wird.
//
// "desinfizieren/desinfizierend" kommt hier bewusst nicht mehr vor - siehe
// Kopfkommentar in checklistAreas.js.

// Reihenfolge = Vorschlagsreihenfolge. Häufig genutzte Formulierungen oben.
export const TASK_SUGGESTIONS = [
  // Böden
  'Hartböden feucht wischen',
  'Hartböden feucht wischen & Textilbeläge saugen',
  'Hartböden feucht wischen bzw. kehren',
  'Textilbeläge saugen',
  'Textilbeläge in den Fluren saugen',
  'Böden kehren',
  'Böden feucht wischen mit Hygienereiniger',
  'Feuchte Reinigung der Fußleisten',
  'Fußleisten entstauben',
  'Grundreinigung Böden',
  'Kehren & maschinelle Bodenreinigung großflächig',
  'Verkehrswege feucht wischen',
  'Grobschmutz & Fremdkörper entfernen',

  // Abfall
  'Abfallbehälter leeren inkl. Austausch der Beutel',
  'Abfallbehälter leeren',
  'Abfallbehälter leeren & Beutel austauschen',
  'Abfall trennen und entsorgen (Restmüll, Papier, Glas nach Vorgabe)',
  'Sonderabfall gesondert entsorgen',

  // Staub, Spinnweben
  'Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken',
  'Entfernen von Staub & Spinnweben an Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken',
  'Staub & Spinnweben',
  'Staub & Spinnweben an Decken und Fenster-/Glasflächen entfernen',
  'Bildschirme, Tastaturen & Telefone entstauben',
  'Entstauben der Physiogeräte',

  // Türen, Schalter, Glas innen
  'Feuchte Reinigung der Türblätter & Türklinken',
  'Türblätter & Türklinken',
  'Feuchte Reinigung der Türblätter & Türklinken der Eingangstür',
  'Zwischentüren',
  'Entfernen von Fingerabdrücken & Schlieren von Innenverglasungen, Türen & Einbauschränken',
  'Entfernen von Fingerabdrücken & Schlieren von Innenverglasungen, Türen, Küchen- & Einbauschränken',
  'Entfernen von Fingerabdrücken & Schlieren an Zwischentüren',
  'Lichtschalter & Steckdosenrahmen feucht abwischen',
  'Türklinken & Lichtschalter feucht abwischen',
  'Steckdosen & Schalter reinigen',

  // Oberflächen, Mobiliar
  'Reinigung der Oberflächen von Arbeits- & Schreibtischen',
  'Reinigung der Oberflächen von Arbeits- & Schreibtischen (nur freigeräumte Flächen)',
  'Arbeitsflächen & Ablagen feucht abwischen',
  'Schreibtische feucht abwischen',
  'Arbeitstische reinigen',
  'Besprechungstische feucht abwischen',
  'Tresen & Ablageflächen reinigen',
  'Sitzflächen abwischen',
  'Sitzflächen & Wartebereich-Möbel feucht abwischen',
  'Telefone & Klingelanlage feucht abwischen',
  'Heizkörper abwischen',
  'Liegen & Behandlungsflächen (Auflagen) feucht abwischen',

  // Fenster, Fensterbänke, Glas
  'Feuchte Reinigung der Fensterbänke & Fußleisten',
  'Feuchte Reinigung der Fensterbänke',
  'Fensterbänke innen und außen feucht wischen',
  'Fensterrahmen abwischen',
  'Fensterscheiben reinigen innen/außen',
  'Reinigung der Glasflächen innen und außen',
  'Alle Glasflächen an Fenstern innen und außen reinigen',
  'Entfernung von Verschmutzungen wie Staub, Fingerabdrücken und Schmierrückständen',
  'Rahmenreinigung im Zuge der Glasreinigung',
  'Reinigung von Rahmen, Falzen, Dichtungen, Griffen und Fensterbänken, soweit ausdrücklich vereinbart',
  'Glasscheiben von Fingerabdrücken befreien',
  'Türverglasung reinigen',
  'Lamellenreinigung (Jalousien/Sonnenschutz)',

  // Sanitär
  'WC-Oberflächen, WC-Sitze, Urinale & Spülungen säubern',
  'Feuchte Reinigung aller Sanitärobjekte (WC, Waschbecken, Armaturen)',
  'Waschbecken, Armaturen & Wandspiegel reinigen',
  'WC Fliesenwände reinigen',
  'Urinale reinigen inkl. Entfernung von Urin- und Kalkansätzen',
  'Seifen-, Handtuch- & Hygienespender kontrollieren und auffüllen',
  'Toilettenpapier & Hygieneartikel auffüllen',
  'Duschköpfe reinigen',
  'Duschkabinen reinigen und entkalken',
  'Vollreinigung der Dusche inkl. Armaturen & Fliesen',
  'Abflüsse auf Durchgängigkeit prüfen & reinigen',
  'Bodenablauf reinigen',
  'Grundreinigung Sanitärbereiche',

  // Küche
  'Feuchte Reinigung der Oberflächen & Arbeitsplatten',
  'Arbeitsflächen feucht reinigen',
  'Spüle reinigen und Kalkansätze entfernen',
  'Waschbecken & Armatur reinigen',
  'Küchengeräte außen abwischen (Mikrowelle, Kaffeemaschine, Kühlschrank)',
  'Kühlschrank außen abwischen',
  'Mikrowelle innen & außen reinigen',
  'Kaffeemaschine reinigen',
  'Geschirrspüler außen abwischen',

  // Eingang, Treppenhaus, Wohnanlage
  'Feuchte Reinigung der Hauseingangstür',
  'Schmutzfang an der Hauseingangstür',
  'Schmutzfang herausnehmen, ausklopfen und von Dreck befreien',
  'Fußmatten reinigen (schütteln, saugen oder nass abwischen je nach Typ)',
  'Briefkasten- & Klingelanlage',
  'Briefkastenanlage & Klingelanlage feucht abwischen',
  'Treppengeländer & Handläufe',
  'Feuchte Reinigung der Treppengeländer & Handläufe',
  'Handläufe abwischen',
  'Treppenstufen kehren und feucht wischen',
  'Aufzugskabine reinigen',
  'Türlaufschienen & Schwellen reinigen',
  'Kellerflur kehren',
  'Waschküche reinigen',

  // Hausmeisterservice
  'Tonnenservice / Abfallentsorgung',
  'Tonnenservice / Bereitstellung der Abfallbehälter für die AWB',
  'Kontrollgang Allgemeinbereiche',
  'Kontrolle Sperrmüll-/Entrümpelungsraum',
  'Kontrolle der Flucht- und Verkehrswege',
  'Kontrolle und Pflege der Mülltonnenstandplätze',
  'Kontrolle auf Beschädigungen, Vandalismus und sonstige Auffälligkeiten',
  'Entrümpelung / Entfernung von Gegenständen',
  'Umsetzung abgestellter Gegenstände aus Allgemeinbereichen',

  // Ausschlüsse (werden bewusst im LV genannt)
  'Akten, Unterlagen, Waren & Regale werden nicht angefasst oder verschoben',
  'Abgestellte Gegenstände werden nicht verschoben oder entsorgt',
  'Spielzeug wird nicht gereinigt oder bewegt (pädagogisches Eigentum)',

  // Sonstiges
  'Umkleiden reinigen',
  'Pausenraum reinigen',
  'Gehwege von Schnee räumen',
  'Gehwege bei Glätte abstreuen',
  'Zufahrten & Parkplätze räumen',
  'Treppen & Eingangsbereiche räumen und streuen',
  'Streugut nach Tauwetter entfernen/kehren',
  'Kontrolle und Nachstreuen im Tagesverlauf',
];

// Kurzbezeichnung -> ausformulierte Leistungsbeschreibung. Wird beim
// Übernehmen eines Vorschlags mitgesetzt, damit der Langtext nicht jedes Mal
// neu getippt werden muss.
export const TASK_DESCRIPTIONS = {
  'Hartböden feucht wischen':
    'Feuchte Reinigung der Hartbodenflächen einschließlich Entfernung von Schmutz, Staub und sonstigen oberflächlichen Verunreinigungen.',
  'Hartböden feucht wischen & Textilbeläge saugen':
    'Feuchte Reinigung der Hartbodenflächen und gründliches Absaugen der textilen Bodenbeläge einschließlich Entfernung von Schmutz, Staub und sonstigen oberflächlichen Verunreinigungen.',
  'Hartböden feucht wischen bzw. kehren':
    'Kehren bzw. feuchte Reinigung der zugänglichen Hartbodenflächen einschließlich Entfernung von Schmutz und sonstigen oberflächlichen Verunreinigungen.',
  'Textilbeläge in den Fluren saugen':
    'Gründliches Absaugen der textilen Bodenbeläge in den Flur- und Verkehrsbereichen.',
  'Textilbeläge saugen': 'Gründliches Absaugen der textilen Bodenbeläge.',
  'Feuchte Reinigung der Fußleisten':
    'Feuchte Reinigung der Fußleisten einschließlich Entfernung von Staub und oberflächlichen Verschmutzungen.',

  'Abfallbehälter leeren inkl. Austausch der Beutel':
    'Entleerung der vorhandenen Abfallbehälter einschließlich Austausch der Abfallbeutel und ordnungsgemäße Entsorgung des anfallenden Abfalls.',
  'Abfallbehälter leeren':
    'Entleerung der vorhandenen Abfallbehälter einschließlich Austausch der Abfallbeutel und ordnungsgemäße Entsorgung des anfallenden Abfalls.',
  'Abfallbehälter leeren & Beutel austauschen':
    'Entleerung der vorhandenen Abfallbehälter einschließlich Austausch der Abfallbeutel und ordnungsgemäße Entsorgung des anfallenden Abfalls.',
  'Abfall trennen und entsorgen (Restmüll, Papier, Glas nach Vorgabe)':
    'Entleerung der Abfallbehälter, Austausch der Abfallbeutel und Zuführung des getrennten Abfalls zu den vorgesehenen Sammelstellen.',

  'Entfernen von Staub & Spinnweben an Mobiliar, Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken':
    'Entfernung von Staub, Spinnweben und sonstigen losen Verschmutzungen an Decken, Leuchten, Wandleuchten, Heizkörpern sowie in Ecken und schwer zugänglichen Bereichen.',
  'Entfernen von Staub & Spinnweben an Decken, Lampen, Wandleuchten, Heizkörpern & in Ecken':
    'Entfernung von Staub, Spinnweben und sonstigen losen Verschmutzungen an Decken, Leuchten, Wandleuchten, Heizkörpern sowie in Ecken und zugänglichen Bereichen.',
  'Staub & Spinnweben':
    'Entfernung von Staub, Spinnweben und sonstigen losen Verschmutzungen an Decken, Leuchten, Wandleuchten, Heizkörpern sowie in Ecken und schwer zugänglichen Bereichen.',
  'Bildschirme, Tastaturen & Telefone entstauben':
    'Entstauben der Bildschirme, Tastaturen und Telefone. Geräte werden dabei nicht bewegt oder vom Strom getrennt.',

  'Feuchte Reinigung der Türblätter & Türklinken':
    'Feuchte Reinigung der Türblätter und Türklinken einschließlich Entfernung von Fingerabdrücken, Handabdrücken und sonstigen Verschmutzungen.',
  'Türblätter & Türklinken':
    'Feuchte Reinigung der Türblätter und Türklinken einschließlich Entfernung von Fingerabdrücken, Handabdrücken und sonstigen Verschmutzungen.',
  Zwischentüren:
    'Entfernung von Fingerabdrücken, Handabdrücken und Schlieren an den Türblättern und Türgriffen der Zwischentüren.',
  'Entfernen von Fingerabdrücken & Schlieren von Innenverglasungen, Türen & Einbauschränken':
    'Entfernung von Fingerabdrücken, Handabdrücken und Schlieren an Innenverglasungen, Glastüren und Einbauschränken.',
  'Lichtschalter & Steckdosenrahmen feucht abwischen':
    'Feuchte Reinigung der Lichtschalter und Steckdosenrahmen einschließlich Entfernung von Griffspuren und Fingerabdrücken.',
  'Türklinken & Lichtschalter feucht abwischen':
    'Feuchte Reinigung der Lichtschalter und Steckdosenrahmen einschließlich Entfernung von Griffspuren und Fingerabdrücken.',

  'Reinigung der Oberflächen von Arbeits- & Schreibtischen':
    'Feuchte Reinigung der freigeräumten Oberflächen von Arbeits- und Schreibtischen einschließlich Entfernung von Staub und oberflächlichen Verschmutzungen.',
  'Reinigung der Oberflächen von Arbeits- & Schreibtischen (nur freigeräumte Flächen)':
    'Feuchte Reinigung der freigeräumten Oberflächen von Arbeits- und Schreibtischen. Belegte Flächen, Unterlagen und persönliche Gegenstände werden nicht verschoben.',
  'Arbeitsflächen & Ablagen feucht abwischen':
    'Feuchte Reinigung der freigeräumten Arbeitsflächen und Ablagen einschließlich Entfernung von Staub und oberflächlichen Verschmutzungen.',
  'Sitzflächen & Wartebereich-Möbel feucht abwischen':
    'Feuchte Reinigung der Sitzflächen, Armlehnen und Beistelltische im Wartebereich einschließlich Entfernung von Griffspuren und oberflächlichen Verschmutzungen.',

  'Feuchte Reinigung der Fensterbänke & Fußleisten':
    'Feuchte Reinigung der Fensterbänke und Fußleisten einschließlich Entfernung von Staub und oberflächlichen Verschmutzungen.',
  'Feuchte Reinigung der Fensterbänke':
    'Feuchte Reinigung der Fensterbänke, sofern frei und zugänglich.',
  'Reinigung der Glasflächen innen und außen':
    'Streifen- und schlierenfreie Reinigung der vereinbarten Glasflächen an Fenstern, Glaswänden und Trennwänden. Außenreinigung nur bei öffnungsfähigen bzw. erreichbaren Flächen und sofern keine festen Gitter oder Hindernisse vorhanden sind.',
  'Alle Glasflächen an Fenstern innen und außen reinigen':
    'Streifen- und schlierenfreie Reinigung aller vereinbarten Glasflächen inklusive Rahmen. Nur bei öffnungsfähigen bzw. erreichbaren Flächen; Außenreinigung nur, sofern keine festen Gitter oder Hindernisse vorhanden sind.',
  'Rahmenreinigung im Zuge der Glasreinigung':
    'Reinigung von Rahmen, Falzen, Dichtungen, Griffen und Fensterbänken, soweit frei zugänglich und ausdrücklich vereinbart.',
  'Lamellenreinigung (Jalousien/Sonnenschutz)':
    'Reinigung der Lamellen bzw. Jalousien einschließlich Entfernung von Staub und oberflächlichen Verschmutzungen. Beschädigte oder verzogene Elemente werden nicht bearbeitet.',

  'WC-Oberflächen, WC-Sitze, Urinale & Spülungen säubern':
    'Reinigung der WC-Becken, WC-Sitze, Urinale, Spülkästen und des angrenzenden Spritzbereichs einschließlich Entfernung von Urin- und Kalkansätzen.',
  'Waschbecken, Armaturen & Wandspiegel reinigen':
    'Reinigung und Politur von Waschbecken, Armaturen, Ablagen und Wandspiegeln einschließlich Entfernung von Kalkansätzen, Fingerabdrücken und Rückständen.',
  'WC Fliesenwände reinigen':
    'Feuchte Reinigung der Fliesen-, Scham- und Trennwände im Spritzwasserbereich einschließlich Entfernung von Rückständen.',
  'Seifen-, Handtuch- & Hygienespender kontrollieren und auffüllen':
    'Kontrolle und Auffüllen von Flüssigseife, Papierhandtüchern und Toilettenpapier sowie feuchte Reinigung der Spendergehäuse.',
  'Vollreinigung der Dusche inkl. Armaturen & Fliesen':
    'Reinigung von Duschwanne bzw. -kabine, Armaturen, Duschkopf und angrenzenden Fliesenflächen einschließlich Entfernung von Seifen- und Kalkrückständen.',
  'Abflüsse auf Durchgängigkeit prüfen & reinigen':
    'Sichtprüfung der Abläufe auf Durchgängigkeit sowie Reinigung der zugänglichen Ablaufsiebe. Rohrreinigungsarbeiten sind nicht enthalten.',

  'Feuchte Reinigung der Oberflächen & Arbeitsplatten':
    'Feuchte Reinigung der freigeräumten Arbeitsplatten, Ober- und Ablageflächen einschließlich Entfernung von Speiseresten und oberflächlichen Verschmutzungen.',
  'Waschbecken & Armatur reinigen':
    'Reinigung und Politur von Spüle, Armatur und Ausguss einschließlich Entfernung von Kalkansätzen und Rückständen.',
  'Küchengeräte außen abwischen (Mikrowelle, Kaffeemaschine, Kühlschrank)':
    'Feuchte Reinigung der Außenflächen von Mikrowelle, Kaffeemaschine, Kühlschrank und Geschirrspüler. Die Innenreinigung ist nicht enthalten.',

  'Feuchte Reinigung der Hauseingangstür':
    'Feuchte Reinigung der Türblätter und Türklinken der Hauseingangstür einschließlich Entfernung von Fingerabdrücken und sonstigen Verschmutzungen.',
  'Schmutzfang an der Hauseingangstür':
    'Aufnehmen, Ausklopfen und Reinigung der Schmutzfangmatten einschließlich Entfernung von losem Schmutz und Verunreinigungen.',
  'Fußmatten reinigen (schütteln, saugen oder nass abwischen je nach Typ)':
    'Aufnehmen, Ausklopfen und Reinigung der Schmutzfangmatten einschließlich Entfernung von losem Schmutz und Verunreinigungen.',
  'Briefkasten- & Klingelanlage':
    'Feuchte Reinigung der Briefkasten- und Klingelanlagen einschließlich Entfernung von Staub, Fingerabdrücken und sonstigen oberflächlichen Verschmutzungen.',
  'Treppengeländer & Handläufe':
    'Feuchte Reinigung der Treppengeländer, Handläufe und sonstigen Griffbereiche einschließlich Entfernung von Staub, Fingerabdrücken und Verschmutzungen.',
  'Feuchte Reinigung der Treppengeländer & Handläufe':
    'Feuchte Reinigung der Treppengeländer, Handläufe und sonstigen Griffbereiche einschließlich Entfernung von Staub, Fingerabdrücken und Verschmutzungen.',
  'Aufzugskabine reinigen':
    'Reinigung der Aufzugsinnenflächen, insbesondere Boden, Wandflächen und Bedienfeld, einschließlich Entfernung von Fingerabdrücken und sonstigen Verschmutzungen.',
  'Türlaufschienen & Schwellen reinigen':
    'Reinigung der Türlaufschienen und Schwellen einschließlich Entfernung von losem Schmutz und Ablagerungen.',

  'Tonnenservice / Abfallentsorgung':
    'Bereitstellung und Rückstellung der Abfallbehälter zu den Abholterminen sowie Entfernung und ordnungsgemäße Zuordnung von Kleinstmüll aus dem Sperrmüll-/Entrümpelungsraum im Rahmen des Mülltonnenservices.',
  'Tonnenservice / Bereitstellung der Abfallbehälter für die AWB':
    'Bereitstellung und Rückstellung der Abfallbehälter zu den Abholterminen.',
  'Kontrollgang Allgemeinbereiche':
    'Regelmäßiger Kontrollgang durch die Allgemein-, Flur-, Verkehrs- und Fluchtbereiche auf erkennbare Verschmutzungen, Beschädigungen, Vandalismus, defekte Leuchtmittel, abgestellte Gegenstände und sonstige Auffälligkeiten. Festgestellte Mängel werden der Hausverwaltung gemeldet.',
  'Kontrolle Sperrmüll-/Entrümpelungsraum':
    'Kontrolle des Sperrmüll-/Entrümpelungsraums auf abgestellte Gegenstände, Verschmutzungen und ordnungswidrige Ablagerungen.',
  'Kontrolle der Flucht- und Verkehrswege':
    'Kontrolle der Allgemein-, Verkehrs- und Fluchtwege auf abgestellte Möbel, Schuhschränke, Gegenstände und sonstige Behinderungen. Bei festgestellten Verstößen erfolgt ein Hinweis an die Bewohner bzw. eine Information an die Hausverwaltung.',
  'Kontrolle und Pflege der Mülltonnenstandplätze':
    'Kontrolle der Mülltonnenstandplätze auf Verschmutzungen, Fehlbefüllungen und ordnungsgemäßen Zustand.',
  'Kontrolle auf Beschädigungen, Vandalismus und sonstige Auffälligkeiten':
    'Festgestellte Mängel werden dokumentiert bzw. an die Hausverwaltung gemeldet.',
  'Entrümpelung / Entfernung von Gegenständen':
    'Entrümpelung des Sperrmüll-/Entrümpelungsraums sowie Entfernung bzw. Verbringung abgestellter Gegenstände aus Allgemein- und Verkehrsbereichen nach vorheriger Beauftragung durch die Hausverwaltung.',
  'Umsetzung abgestellter Gegenstände aus Allgemeinbereichen':
    'Nach Rücksprache bzw. Beauftragung durch die Hausverwaltung; Verbringung in den vorgesehenen Sperrmüll-/Entrümpelungsraum.',

  'Akten, Unterlagen, Waren & Regale werden nicht angefasst oder verschoben':
    'Akten, Unterlagen, Waren und Regalinhalte werden nicht angefasst, verschoben oder entstaubt.',
  'Abgestellte Gegenstände werden nicht verschoben oder entsorgt':
    'Privates Eigentum, Kellerabteile und abgestellte Gegenstände werden nicht angefasst, verschoben oder entsorgt.',
};

// Wiederkehrende Bemerkungen, die bisher jedes Mal frei getippt wurden.
// Objektspezifisch, deshalb bewusst getrennt von TASK_DESCRIPTIONS.
export const REMARK_SUGGESTIONS = [
  'Sofern frei zugänglich.',
  'Keine Behandlungsflächen.',
  'Sonderabfall wird nicht entsorgt.',
  'Reinigung mit Sanitär- und Hygienereiniger.',
  'Verbrauchsmaterial wird vom Auftragnehmer gestellt und gesondert berechnet.',
  'Verbrauchsmaterial wird vom Auftraggeber gestellt.',
  'Wird immer am ersten Reinigungstag der Woche ausgeführt.',
  'Wird immer am zweiten Reinigungstag der Woche ausgeführt.',
  'Nur bei öffnungsfähigen bzw. erreichbaren Flächen.',
  'Außenreinigung nur, sofern keine festen Gitter/Hindernisse vorhanden sind.',
  'Nach vorheriger Beauftragung durch die Hausverwaltung.',
  'Festgestellte Mängel werden der Hausverwaltung gemeldet.',
  'Die Innenreinigung ist nicht enthalten.',
  'Nach Absprache mit dem Auftraggeber.',
  'Auf Anfrage und gegen gesonderte Berechnung.',
];

function matches(list, query, limit) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  // Treffer am Wortanfang zuerst, danach Treffer irgendwo im Text - die
  // Reihenfolge innerhalb der Gruppen bleibt die Häufigkeitsreihenfolge
  // der Liste.
  const starts = [];
  const contains = [];
  list.forEach((s) => {
    const low = s.toLowerCase();
    if (low.startsWith(q)) starts.push(s);
    else if (low.includes(q)) contains.push(s);
  });
  return [...starts, ...contains].slice(0, limit);
}

export function getSuggestions(query, limit = 8) {
  return matches(TASK_SUGGESTIONS, query, limit);
}

export function getRemarkSuggestions(query, limit = 6) {
  const q = query.trim();
  if (!q) return REMARK_SUGGESTIONS.slice(0, limit);
  return matches(REMARK_SUGGESTIONS, q, limit);
}

// Ausformulierte Beschreibung zu einer Kurzbezeichnung, oder '' wenn es
// dafür keinen Katalogtext gibt.
export function getDescriptionFor(text) {
  return TASK_DESCRIPTIONS[(text || '').trim()] || '';
}

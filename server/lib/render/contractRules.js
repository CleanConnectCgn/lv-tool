// "Vorgaben" für den Vertragsgenerator (Baustein-System): rein deterministische,
// codierte Regeln - keine KI. Wird an zwei Stellen aufgerufen:
// 1. server/lib/documentRoutes.js beim Anlegen eines Vertrags (errors blockieren
//    mit HTTP 400, warnings werden nur mitgegeben).
// 2. contractDocx.js bei JEDEM Rendern (auch bei späteren Downloads), damit ein
//    unvollständiger Vertrag nie unbemerkt wie ein fertiger aussieht.
//
// errors = technisch unsinnige/widersprüchliche Eingaben, die eine Erstellung
// verhindern. warnings = fachlich fehlende Angaben, die einen Entwurf nicht
// verhindern sollen (die bestehende Arbeitsweise "Vertrag erst grob anlegen,
// Details später ergänzen" bleibt möglich) - sie werden stattdessen sichtbar
// gemacht (API-Response + Warnbanner im DOCX).
import { DSGVO_VARIANTEN, BRANCHE_ZU_DSGVO } from './contractFields.js';

export function validateContract(data = {}) {
  const errors = [];
  const warnings = [];

  const dsgvoVariante = data.dsgvoVariante || 'standard';
  if (!DSGVO_VARIANTEN[dsgvoVariante]) {
    errors.push(`Unbekannte Datenschutz-Klausel "${dsgvoVariante}"`);
  }

  if (data.kuendigungsfristMonate != null && Number(data.kuendigungsfristMonate) <= 0) {
    errors.push('Kündigungsfrist muss größer als 0 Monate sein');
  }

  if (data.mwstSatz != null) {
    const satz = Number(data.mwstSatz);
    if (Number.isNaN(satz) || satz < 0 || satz > 25) {
      errors.push('MwSt.-Satz muss zwischen 0 und 25 liegen');
    }
  }

  if (data.laufzeitMonate != null && Number(data.laufzeitMonate) < 0) {
    errors.push('Laufzeit darf nicht negativ sein');
  }

  // Kunde/Objekt kommen serverseitig aus der DB (documentRoutes.js), nicht
  // aus Nutzereingaben im Formular - können aber trotzdem leer sein (siehe
  // reale Bestandslücke "ohja events" in MIGRATION.md: keine Adresse
  // vorhanden). Beide führen sonst zu "[Auftraggeber]"/"[Objektadresse]"-
  // Platzhaltern im Dokumenttext (contractDocx.js) - das muss im Banner
  // genauso sichtbar sein wie die anderen Lücken, sonst wäre der Banner
  // unvollständig gegenüber dem, was tatsächlich im Dokument steht.
  if (!data.kunde?.firma) {
    warnings.push('Kundenname fehlt (Platzhalter "[Auftraggeber]" im Dokument)');
  }
  if (!data.objektAdresse) {
    warnings.push('Objektadresse fehlt (Platzhalter "[Objektadresse]" im Dokument)');
  }
  if (!data.vertragsbeginn) {
    warnings.push('Leistungsbeginn fehlt (Platzhalter "[Datum]" im Dokument)');
  }
  if (data.verguetungNetto === null || data.verguetungNetto === undefined || data.verguetungNetto === '') {
    warnings.push('Vergütung (netto) fehlt');
  }
  if (!data.reinigungsintervall) {
    warnings.push('Reinigungsintervall fehlt');
  }
  if (!data.internerAnsprechpartner) {
    warnings.push('Interner Ansprechpartner fehlt');
  }

  if (data.branche && DSGVO_VARIANTEN[dsgvoVariante] && BRANCHE_ZU_DSGVO[data.branche] !== dsgvoVariante) {
    const empfohlen = BRANCHE_ZU_DSGVO[data.branche];
    warnings.push(
      `Datenschutz-Klausel "${dsgvoVariante}" passt laut Branche "${data.branche}" nicht zur empfohlenen ` +
        `Variante "${empfohlen}" - bitte prüfen`
    );
  }

  return { errors, warnings };
}

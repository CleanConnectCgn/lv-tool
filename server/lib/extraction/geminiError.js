// Übersetzt rohe Fehler des Gemini-SDKs in verständliche, handlungsorientierte
// Meldungen. Die SDK-Meldungen sind lang und enthalten die komplette Endpoint-
// URL; für die Anzeige im Import-Review/Posteingang taugt davon meist nur der
// Kern (Status + Ursache). Die Reihenfolge ist bewusst: 429/Quota zuerst,
// danach die spezifischeren 400/401/404-Fälle.
export function geminiErrorMessage(err) {
  const raw = err?.message || String(err);

  // Vorübergehende Überlastung auf Googles Seite. Der Aufruf wird intern
  // bereits mehrfach wiederholt (server/lib/geminiCall.js); wenn die Meldung
  // hier ankommt, waren alle Versuche betroffen.
  if (
    err?.status === 503 ||
    /503|overloaded|high demand|service unavailable/i.test(raw)
  ) {
    return 'Gemini ist gerade überlastet. Das ist vorübergehend - bitte in einer Minute noch einmal versuchen.';
  }
  if (err?.status === 500 || err?.status === 502 || err?.status === 504) {
    return 'Gemini hat mit einem Serverfehler geantwortet. Bitte gleich noch einmal versuchen.';
  }
  if (/hat nicht innerhalb von .* geantwortet/i.test(raw)) {
    return 'Gemini hat zu lange gebraucht und wurde abgebrochen. Bitte noch einmal versuchen.';
  }
  if (err?.status === 429 || /429|quota|exceeded/i.test(raw)) {
    return 'Gemini-Kontingent erschöpft (429). Bitte GEMINI_API_KEY/Billing in Railway prüfen.';
  }
  if (/unable to process input image|invalid image/i.test(raw)) {
    return 'Die Datei konnte von Gemini nicht gelesen werden (Bild/PDF beschädigt oder Format nicht unterstützt).';
  }
  if (err?.status === 400 || /request contains an invalid argument/i.test(raw)) {
    return 'Die Datei konnte von Gemini nicht gelesen werden (ungültiges Bild/PDF-Format).';
  }
  if (err?.status === 401 || /api key not valid|api_key_invalid|invalid api key/i.test(raw)) {
    return 'GEMINI_API_KEY ist ungültig. Bitte den Key in Railway erneuern.';
  }
  if (err?.status === 404 || /model.*not found|not found.*model/i.test(raw)) {
    return 'Das Gemini-Modell ist nicht verfügbar (404). Bitte Modellnamen prüfen.';
  }
  return raw;
}

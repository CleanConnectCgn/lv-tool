// Gemeinsamer Timeout-Helfer für KI-Aufrufe, damit ein hängender Provider
// eine Anfrage nie unbegrenzt blockiert. Vorher nur lokal in server/index.js
// definiert; server/lib/extraction/gemini.js und server/lib/documentRoutes.js
// hatten gar keinen Timeout (gefunden 2026-07-31 beim Prüfen aller KI-
// Checkups - ein hängender Gemini-Aufruf beim Dokument-Import hätte nie
// fehlgeschlagen, sondern einfach ewig "Liest aus..." angezeigt).
export function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} hat nicht innerhalb von ${ms / 1000}s geantwortet`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

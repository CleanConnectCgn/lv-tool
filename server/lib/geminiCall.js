// Ein Gemini-Aufruf mit Timeout und automatischem Wiederholen.
//
// Gemini antwortet gelegentlich mit 503 ("This model is currently
// experiencing high demand"). Das ist kein Fehler der Anfrage, sondern eine
// vorübergehende Überlastung auf Googles Seite - typischerweise Sekunden.
// Ohne Wiederholung landet das als roher Fehlertext vor dem Nutzer, obwohl
// der zweite Versuch fast immer durchgeht.
//
// Wiederholt wird nur bei Fehlern, bei denen das überhaupt helfen kann.
// Ein ungültiger Key oder ein kaputtes PDF werden sofort durchgereicht.

import { withTimeout } from './withTimeout.js';

// 503 Überlastung, 500/502 Serverfehler, sowie abgebrochene Verbindungen.
export function istVoruebergehend(err) {
  const status = err?.status ?? err?.response?.status;
  if ([500, 502, 503, 504].includes(status)) return true;
  const text = err?.message || String(err || '');
  return /503|overloaded|high demand|service unavailable|internal error|ECONNRESET|ETIMEDOUT|fetch failed|socket hang up/i.test(
    text
  );
}

const warte = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Führt einen Gemini-Aufruf aus und wiederholt ihn bei vorübergehenden
 * Fehlern.
 *
 * @param {Function} aufruf      erzeugt den Aufruf neu, z.B. () => model.generateContent(prompt)
 * @param {Object}   optionen
 * @param {number}   optionen.timeoutMs   Zeitlimit je Versuch
 * @param {number}   optionen.versuche    Gesamtzahl der Versuche (Standard 3)
 * @param {number}   optionen.pauseMs     Wartezeit vor dem ersten erneuten Versuch
 * @param {string}   optionen.label       Name für die Timeout-Meldung
 */
export async function geminiMitRetry(
  aufruf,
  { timeoutMs = 60000, versuche = 3, pauseMs = 800, label = 'Gemini' } = {}
) {
  let letzterFehler;
  for (let versuch = 1; versuch <= versuche; versuch++) {
    try {
      return await withTimeout(aufruf(), timeoutMs, label);
    } catch (err) {
      letzterFehler = err;
      const nochVersucheOffen = versuch < versuche;
      if (!nochVersucheOffen || !istVoruebergehend(err)) throw err;
      // Wartezeit verdoppelt sich: 0,8s, dann 1,6s.
      const pause = pauseMs * 2 ** (versuch - 1);
      console.warn(
        `[gemini] Versuch ${versuch}/${versuche} fehlgeschlagen (${err?.message || err}), erneut in ${pause}ms`
      );
      await warte(pause);
    }
  }
  throw letzterFehler;
}

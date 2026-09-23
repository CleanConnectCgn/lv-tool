// Ein Gemini-Aufruf mit Timeout, Wiederholung und Modellwechsel.
//
// Hintergrund (23.09.2026): Das bis dahin fest verdrahtete Modell
// "gemini-flash-latest" antwortete über Stunden mit
// 503 "This model is currently experiencing high demand", während
// "gemini-3.6-flash" zur selben Zeit sofort lieferte. Eine reine
// Wiederholung auf demselben Modell half in dem Fall also nicht - es braucht
// ein Ausweichmodell.
//
// Ablauf: Für jedes Modell der Kette werden ein paar Versuche unternommen.
// Bleibt es bei einem vorübergehenden Fehler, geht es mit dem nächsten
// Modell weiter. Ein dauerhafter Fehler (ungültiger Key, kaputtes PDF,
// erschöpftes Kontingent) bricht sofort ab, statt sinnlos weiterzuprobieren.

import { withTimeout } from './withTimeout.js';

// Reihenfolge = Vorrang. Über GEMINI_MODELS überschreibbar (kommagetrennt),
// damit sich bei einer Störung ohne neuen Deploy umschalten lässt.
export const GEMINI_MODELLE = (
  process.env.GEMINI_MODELS || 'gemini-3.6-flash,gemini-flash-latest,gemini-3.1-flash-lite'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// 503 Überlastung, 500/502/504 Serverfehler sowie abgebrochene Verbindungen.
export function istVoruebergehend(err) {
  const status = err?.status ?? err?.response?.status;
  if ([500, 502, 503, 504].includes(status)) return true;
  const text = err?.message || String(err || '');
  return /503|overloaded|high demand|service unavailable|internal error|ECONNRESET|ETIMEDOUT|fetch failed|socket hang up/i.test(
    text
  );
}

// Ein Modell, das es (für diesen Zugang) nicht mehr gibt: kein Grund
// aufzugeben, aber auch kein Grund, es erneut zu versuchen - direkt weiter
// zum nächsten Modell der Kette.
export function istModellProblem(err) {
  const status = err?.status ?? err?.response?.status;
  const text = err?.message || String(err || '');
  return status === 404 || /not found|no longer available|not supported for generateContent/i.test(text);
}

const warte = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Führt einen Gemini-Aufruf aus, wiederholt ihn bei vorübergehenden Fehlern
 * und weicht danach auf das nächste Modell aus.
 *
 * @param {Function} aufruf   bekommt den Modellnamen und erzeugt den Aufruf,
 *                            z.B. (modell) => client(modell).generateContent(prompt)
 * @param {Object}   optionen
 * @param {number}   optionen.timeoutMs        Zeitlimit je Versuch
 * @param {number}   optionen.versuchePorModell Versuche je Modell (Standard 2)
 * @param {number}   optionen.pauseMs          Wartezeit vor dem zweiten Versuch
 * @param {string[]} optionen.modelle          Modellkette (Standard GEMINI_MODELLE)
 * @param {string}   optionen.label            Name für die Timeout-Meldung
 */
export async function geminiMitRetry(
  aufruf,
  { timeoutMs = 60000, versuchePorModell = 2, pauseMs = 800, modelle, label = 'Gemini' } = {}
) {
  const kette = modelle?.length ? modelle : GEMINI_MODELLE;
  let letzterFehler;

  for (let m = 0; m < kette.length; m++) {
    const modell = kette[m];
    for (let versuch = 1; versuch <= versuchePorModell; versuch++) {
      try {
        return await withTimeout(aufruf(modell), timeoutMs, label);
      } catch (err) {
        letzterFehler = err;

        // Zeitüberschreitung: sofort melden. Bei 90s Limit würde ein
        // stilles Weiterprobieren den Nutzer minutenlang warten lassen.
        if (/hat nicht innerhalb von/.test(err?.message || '')) throw err;

        // Modell gibt es nicht (mehr): ohne weitere Versuche zum nächsten.
        if (istModellProblem(err)) {
          console.warn(`[gemini] Modell ${modell} nicht verfügbar (${err?.message || err}), nächstes Modell`);
          break;
        }

        // Dauerhafter Fehler: hier hilft kein weiterer Versuch.
        if (!istVoruebergehend(err)) throw err;

        const letzterVersuchDiesesModells = versuch === versuchePorModell;
        if (letzterVersuchDiesesModells) {
          const nochModelleOffen = m < kette.length - 1;
          console.warn(
            `[gemini] ${modell} weiterhin nicht verfügbar (${err?.message || err})` +
              (nochModelleOffen ? `, wechsle auf ${kette[m + 1]}` : ', keine Modelle mehr übrig')
          );
          break;
        }

        const pause = pauseMs * 2 ** (versuch - 1);
        console.warn(`[gemini] ${modell} Versuch ${versuch}/${versuchePorModell} fehlgeschlagen, erneut in ${pause}ms`);
        await warte(pause);
      }
    }
  }
  throw letzterFehler;
}

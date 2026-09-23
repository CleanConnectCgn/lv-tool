// Sprach- und Chat-Assistent für das Leistungsverzeichnis.
//
// Zwei Endpunkte:
//   POST /api/lv/diktat  - Audioaufnahme -> Transkript (Gemini, reines
//                          Hören, keine Interpretation)
//   POST /api/lv/chat    - Anweisung in normaler Sprache + aktuelles LV
//                          -> strukturierte Änderungsvorschläge
//
// Grundsatz wie bei der Dokument-Auslesung (Block 7): Das Modell liefert
// ausschließlich strukturierte Daten, niemals fertigen Dokumenttext. Was es
// an neuen Zeilen vorschlägt, muss aus dem mitgeschickten Katalog stammen -
// das wird hier serverseitig geprüft, nicht nur im Prompt erbeten. Angewendet
// wird ohnehin nichts: die Vorschläge gehen zur Bestätigung ins Frontend.

import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { geminiMitRetry } from './geminiCall.js';
import { geminiErrorMessage } from './extraction/geminiError.js';

const MODEL = 'gemini-flash-latest';

// Nur diese Aktionen darf der Assistent vorschlagen. Alles andere wird
// verworfen, bevor es das Frontend erreicht.
const ERLAUBTE_AKTIONEN = new Set([
  'intervall_aendern',
  'zeile_entfernen',
  'zeile_hinzufuegen',
  'bereich_hinzufuegen',
  'bereich_entfernen',
  'bemerkung_setzen',
  'titel_setzen',
]);

const ERLAUBTE_SPALTEN = new Set(['woechentlich', 'monatlich', 'jaehrlich', 'aufAnfrage', 'einmalig']);

export function extractJson(raw) {
  const match = (raw || '').match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : raw || '{}');
}

// Prüft jede vom Modell gelieferte Aktion gegen das, was es im LV überhaupt
// gibt. Erfundene Bereiche, erfundene Zeilen und erfundene Intervalle fallen
// hier raus, statt später im Dokument zu landen.
export function validateAktionen(aktionen, { sections = [], katalogTexte = [], areaKeys = [] } = {}) {
  if (!Array.isArray(aktionen)) return [];
  const bereichsTitel = new Map(
    sections.map((s) => [(s.title || '').trim().toLowerCase(), s.title])
  );
  const katalog = new Set(katalogTexte.map((t) => (t || '').trim().toLowerCase()));
  const keys = new Set(areaKeys);

  const zeileExistiert = (bereichTitel, zeilenText) => {
    const sec = sections.find((s) => (s.title || '').trim().toLowerCase() === bereichTitel);
    if (!sec) return false;
    const gesucht = (zeilenText || '').trim().toLowerCase();
    return (sec.rows || []).some((r) => (r.text || '').trim().toLowerCase() === gesucht);
  };

  return aktionen.filter((a) => {
    if (!a || typeof a !== 'object' || !ERLAUBTE_AKTIONEN.has(a.typ)) return false;
    const bereich = (a.bereich || '').trim().toLowerCase();

    switch (a.typ) {
      case 'bereich_hinzufuegen':
        return keys.has(a.areaKey);
      case 'bereich_entfernen':
        return bereichsTitel.has(bereich);
      case 'zeile_hinzufuegen':
        // Nur Leistungen aus dem Katalog, und nur in einen Bereich, den es gibt.
        return bereichsTitel.has(bereich) && katalog.has((a.katalogText || '').trim().toLowerCase());
      case 'zeile_entfernen':
        return bereichsTitel.has(bereich) && zeileExistiert(bereich, a.zeile);
      case 'bemerkung_setzen':
        return (
          bereichsTitel.has(bereich) &&
          zeileExistiert(bereich, a.zeile) &&
          typeof a.text === 'string'
        );
      case 'intervall_aendern':
        if (!bereichsTitel.has(bereich)) return false;
        // Ohne Zeilenangabe gilt die Änderung für den ganzen Bereich.
        if (a.zeile && !zeileExistiert(bereich, a.zeile)) return false;
        if (a.bedarf === true) return true;
        return ERLAUBTE_SPALTEN.has(a.intervalColumn) && !!a.intervalValue;
      case 'titel_setzen':
        return typeof a.titel === 'string' && a.titel.trim().length > 0;
      default:
        return false;
    }
  });
}

function buildPrompt({ nachricht, sections, lvTitle, objekt, katalogTexte, areaListe }) {
  return `Du bist ein Assistent für Leistungsverzeichnisse einer Gebäudereinigung.
Der Nutzer sagt dir, was am Leistungsverzeichnis geändert werden soll. Du führst nichts aus,
sondern lieferst die passenden Änderungen als strukturierte Daten. Ein Mensch bestätigt sie danach.

Aktuelles Leistungsverzeichnis
Titel: ${lvTitle || '(leer)'}
Objekt: ${objekt || '(leer)'}
Bereiche und Zeilen:
${JSON.stringify(sections, null, 2)}

Diese Bereiche kannst du neu hinzufügen (areaKey: Bezeichnung):
${areaListe.map((a) => `${a.key}: ${a.label}`).join('\n')}

Diese Leistungen kannst du als Zeile hinzufügen (exakt so schreiben, nichts erfinden):
${katalogTexte.join('\n')}

Anweisung des Nutzers:
"${nachricht}"

Antworte AUSSCHLIESSLICH mit validem JSON, kein Markdown:
{
  "antwort": "ein bis zwei Sätze, was du vorschlägst - in normaler Sprache",
  "aktionen": [
    { "typ": "intervall_aendern", "bereich": "exakter Bereichstitel", "zeile": "exakter Zeilentext oder null für den ganzen Bereich", "intervalColumn": "woechentlich|monatlich|jaehrlich|aufAnfrage|einmalig", "intervalValue": "z.B. 3x", "bedarf": false },
    { "typ": "zeile_entfernen", "bereich": "exakter Bereichstitel", "zeile": "exakter Zeilentext" },
    { "typ": "zeile_hinzufuegen", "bereich": "exakter Bereichstitel", "katalogText": "exakter Text aus der Katalogliste oben" },
    { "typ": "bereich_hinzufuegen", "areaKey": "key aus der Bereichsliste oben" },
    { "typ": "bereich_entfernen", "bereich": "exakter Bereichstitel" },
    { "typ": "bemerkung_setzen", "bereich": "exakter Bereichstitel", "zeile": "exakter Zeilentext", "text": "die Bemerkung" },
    { "typ": "titel_setzen", "titel": "z.B. Leistungsverzeichnis Unterhaltsreinigung" }
  ]
}

Regeln:
- Bereichstitel und Zeilentexte musst du exakt so schreiben, wie sie oben im LV stehen.
- Neue Zeilen nur aus der Katalogliste. Erfinde keine Leistungen.
- Nur Aktionen, die die Anweisung wirklich verlangt. Im Zweifel lieber keine Aktion und
  stattdessen eine Rückfrage in "antwort".
- Keine Preise, keine Kalkulation, keine Vertragstexte.
- Wenn du die Anweisung nicht verstehst, gib "aktionen": [] zurück und frage in "antwort" nach.`;
}

// Freie Schilderung einer Besichtigung -> Vorbelegung für den Assistenten
// (Objekttyp, Frequenz, Bereiche). Auch hier gilt: nur Auswahl aus dem, was
// es gibt. Erfundene Bereichsschlüssel werden verworfen.
export function validateSetup(vorschlag, { areaKeys = [], typKeys = [] } = {}) {
  const keys = new Set(areaKeys);
  const typen = new Set(typKeys);
  const frequenz = /^[1-7]x$/.test(vorschlag?.frequenz || '') ? vorschlag.frequenz : '';
  return {
    objektTyp: typen.has(vorschlag?.objektTyp) ? vorschlag.objektTyp : '',
    frequenz,
    areas: Array.isArray(vorschlag?.areas) ? vorschlag.areas.filter((k) => keys.has(k)) : [],
    glas: !!vorschlag?.glas,
    winterdienst: !!vorschlag?.winterdienst,
    hinweis: typeof vorschlag?.hinweis === 'string' ? vorschlag.hinweis : '',
  };
}

export function registerLvAssistantRoutes(app, { rateLimiter } = {}) {
  const limiter = rateLimiter || ((req, res, next) => next());

  // Reines Transkribieren. Bewusst getrennt vom Verstehen, damit der Nutzer
  // sieht, was angekommen ist, bevor daraus Änderungen werden.
  app.post(
    '/api/lv/diktat',
    limiter,
    express.raw({ type: () => true, limit: '25mb' }),
    async (req, res) => {
      const mimeType = req.query.mimeType;
      if (!mimeType || !Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: 'mimeType Query-Parameter und Audio-Body sind erforderlich' });
      }
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY ist nicht konfiguriert' });
      }
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: MODEL });
        const result = await geminiMitRetry(() =>
          model.generateContent([
            {
              text: `Schreibe wortgetreu auf, was in dieser Aufnahme gesagt wird. Es geht um die
Besichtigung eines Objekts für ein Reinigungsangebot: Räume, Bereiche, Reinigungsintervalle,
Besonderheiten. Gib nur den Wortlaut zurück, keine Deutung, keine Zusammenfassung, keine
Anführungszeichen. Wenn nichts Verständliches gesagt wird, gib einen leeren Text zurück.`,
            },
            { inlineData: { mimeType, data: req.body.toString('base64') } },
          ]), { timeoutMs: 90000 }
        );
        res.json({ transkript: (result?.response?.text() || '').trim() });
      } catch (err) {
        console.error('[lv/diktat] fehlgeschlagen:', err?.message || err);
        res.status(502).json({ error: geminiErrorMessage(err) });
      }
    }
  );

  // Geschilderte Besichtigung -> Vorbelegung des Assistenten.
  app.post('/api/lv/setup-aus-text', limiter, async (req, res) => {
    const { text, areaListe, typListe } = req.body || {};
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: 'text ist erforderlich' });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY ist nicht konfiguriert' });
    }
    const areas = Array.isArray(areaListe) ? areaListe : [];
    const typen = Array.isArray(typListe) ? typListe : [];
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: MODEL });
      const prompt = `Jemand beschreibt ein Objekt, für das ein Reinigungsangebot entstehen soll.
Das kann eine Schilderung der Besichtigung sein ("Erdgeschoss, drei Büros, ein Bad") oder ein
direkter Auftrag ("Erstelle mir ein Leistungsverzeichnis für eine Logopädiepraxis, Standard").
Leite in beiden Fällen ab, welche Bereiche ins Leistungsverzeichnis gehören und wie oft gereinigt
wird. Wenn nur die Art des Objekts genannt wird, wähle die Bereiche, die dort praktisch immer
vorkommen, und schreibe in "hinweis", was noch zu klären ist.

Beschreibung:
"${String(text).slice(0, 4000)}"

Mögliche Objekttypen (key: Bezeichnung):
${typen.map((t) => `${t.key}: ${t.label}`).join('\n')}

Mögliche Bereiche (key: Bezeichnung):
${areas.map((a) => `${a.key}: ${a.label}`).join('\n')}

Antworte AUSSCHLIESSLICH mit validem JSON, kein Markdown:
{
  "objektTyp": "key aus der Typliste oder leer",
  "frequenz": "1x bis 7x - wie oft pro Woche gereinigt wird, oder leer",
  "areas": ["keys aus der Bereichsliste"],
  "glas": true oder false,
  "winterdienst": true oder false,
  "hinweis": "was unklar geblieben ist und nachgefragt werden sollte, oder leer"
}

Regeln:
- Nur keys aus den Listen oben, nichts erfinden.
- Nur Bereiche, die in der Schilderung wirklich vorkommen.
- Was nicht gesagt wurde, bleibt leer bzw. false - und kommt in "hinweis".`;
      const result = await geminiMitRetry(() => model.generateContent(prompt), { timeoutMs: 60000 });
      const parsed = extractJson(result?.response?.text() || '{}');
      res.json(
        validateSetup(parsed, {
          areaKeys: areas.map((a) => a.key),
          typKeys: typen.map((t) => t.key),
        })
      );
    } catch (err) {
      console.error('[lv/setup-aus-text] fehlgeschlagen:', err?.message || err);
      res.status(502).json({ error: geminiErrorMessage(err) });
    }
  });

  // Anweisung -> Änderungsvorschläge. Wendet selbst nichts an.
  app.post('/api/lv/chat', limiter, async (req, res) => {
    const { nachricht, sections, lvTitle, objekt, katalogTexte, areaListe } = req.body || {};
    if (!nachricht || !String(nachricht).trim()) {
      return res.status(400).json({ error: 'nachricht ist erforderlich' });
    }
    if (!Array.isArray(sections)) {
      return res.status(400).json({ error: 'sections sind erforderlich' });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY ist nicht konfiguriert' });
    }
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: MODEL });
      const prompt = buildPrompt({
        nachricht: String(nachricht).slice(0, 2000),
        sections,
        lvTitle,
        objekt,
        katalogTexte: Array.isArray(katalogTexte) ? katalogTexte : [],
        areaListe: Array.isArray(areaListe) ? areaListe : [],
      });
      const result = await geminiMitRetry(() => model.generateContent(prompt), { timeoutMs: 60000 });
      const parsed = extractJson(result?.response?.text() || '{}');
      const aktionen = validateAktionen(parsed?.aktionen, {
        sections,
        katalogTexte: Array.isArray(katalogTexte) ? katalogTexte : [],
        areaKeys: (Array.isArray(areaListe) ? areaListe : []).map((a) => a.key),
      });
      const verworfen = Array.isArray(parsed?.aktionen) ? parsed.aktionen.length - aktionen.length : 0;
      if (verworfen > 0) {
        console.warn(`[lv/chat] ${verworfen} Aktion(en) verworfen (nicht im LV/Katalog vorhanden)`);
      }
      res.json({
        antwort: typeof parsed?.antwort === 'string' ? parsed.antwort : '',
        aktionen,
        verworfen,
      });
    } catch (err) {
      console.error('[lv/chat] fehlgeschlagen:', err?.message || err);
      res.status(502).json({ error: geminiErrorMessage(err) });
    }
  });
}

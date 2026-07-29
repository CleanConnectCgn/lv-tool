// Gemini-Implementierung des Auslese-Adapters (Block 7). Standardanbieter
// (EXTRACTION_PROVIDER unset oder "gemini") - nutzt den bereits hinterlegten
// GEMINI_API_KEY.
import { GoogleGenerativeAI } from '@google/generative-ai';
import { withTimeout } from '../withTimeout.js';

export const modelName = 'gemini-flash-latest';

// Grobe Kostenschätzung (USD je 1M Token, Gemini 2.5 Flash Preisliste,
// Stand dieser Implementierung) - dient nur der Protokollierung/dem
// ungefähren Überblick, keine verbindliche Abrechnung.
const PRICE_PER_1M_INPUT_TOKENS = 0.075;
const PRICE_PER_1M_OUTPUT_TOKENS = 0.3;

export function estimateCostUsd(usage) {
  if (!usage) return null;
  const inputCost = ((usage.promptTokenCount || 0) / 1_000_000) * PRICE_PER_1M_INPUT_TOKENS;
  const outputCost = ((usage.candidatesTokenCount || 0) / 1_000_000) * PRICE_PER_1M_OUTPUT_TOKENS;
  return Math.round((inputCost + outputCost) * 100000) / 100000;
}

function buildPrompt(catalog) {
  const catalogList = catalog
    .map((c) => `- ${c.id}: ${c.gegenstand} / ${c.verb}${c.zusatz ? ' / ' + c.zusatz : ''}`)
    .join('\n');

  return `Du liest ein bestehendes Leistungsverzeichnis (Foto oder PDF-Scan einer Reinigungsleistungsliste) aus und ordnest JEDE erkannte Position EINEM Eintrag aus dem folgenden geschlossenen Katalog zu.

Du darfst NIEMALS eine catalogItemId erfinden und NIEMALS einen neuen Katalogpunkt vorschlagen - verwende ausschließlich eine der unten aufgeführten IDs, oder markiere die Zeile als nicht zuordenbar (unmatched). Erfinde auch keine neuen Verben oder Tätigkeiten - wenn keine der Katalog-IDs eindeutig passt, gehört die Zeile in "unmatched".

Katalog (nur diese IDs sind gültig):
${catalogList}

Antworte AUSSCHLIESSLICH als valides JSON, kein Markdown, keine Erklärungen:
{
  "matched": [
    {
      "originalText": "wörtlich erkannter Text der Zeile",
      "catalogItemId": "eine ID aus der Liste oben",
      "nachBedarf": true oder false,
      "woechentlich": Zahl oder null,
      "monatlich": Zahl oder null,
      "jaehrlich": Zahl oder null,
      "bemerkung": "NUR Rhythmus/Bedingungen (z.B. 'jeden ersten Dienstag', 'wenn vorhanden') - NIEMALS der Leistungstext selbst"
    }
  ],
  "unmatched": [
    { "originalText": "wörtlich erkannter Text, unverändert" }
  ]
}
Genau EINES von nachBedarf/woechentlich/monatlich/jaehrlich darf pro Position gesetzt sein (die anderen null/false). Bei Unsicherheit lieber in "unmatched" einordnen als zu raten.`;
}

export async function extract({ fileBuffer, mimeType, catalog }) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY ist nicht konfiguriert');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: modelName });

  // Vorher kein Timeout - ein hängender Gemini-Aufruf beim Dokument-Import
  // (Vertragsgenerator/CRM) wäre nie fehlgeschlagen, sondern hätte einfach
  // unbegrenzt "Liest aus..." angezeigt. Gefunden 2026-07-31 beim Prüfen
  // aller KI-Checkups; 90s analog zu den anderen Vision-Aufrufen (siehe
  // server/index.js), da eine reale Testmessung mit einem echten Dokument
  // bereits ~19s brauchte.
  const result = await withTimeout(
    model.generateContent([
      buildPrompt(catalog),
      { inlineData: { data: fileBuffer.toString('base64'), mimeType } },
    ]),
    90000,
    'Gemini'
  );

  const text = result?.response?.text() || '{}';
  const usage = result?.response?.usageMetadata || null;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  let parsed;
  try {
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (err) {
    throw new Error(`Antwort des Modells war kein gültiges JSON: ${err.message}`);
  }

  return { matched: parsed.matched || [], unmatched: parsed.unmatched || [], usage };
}

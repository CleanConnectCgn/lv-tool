// KI-Auslesung für den Posteingang (Eingangs-Ablage): anders als
// gemini.js (LV-Katalog-Extraktion) geht es hier nicht um Leistungspositionen,
// sondern nur darum, WER/WAS das Dokument betrifft, damit es dem richtigen
// Kunden-Ordner vorgeschlagen werden kann (z.B. ein Schlüsselübergabe-
// protokoll -> Kundenname "Modern Mona Lisa"). Nutzt denselben inlineData-
// Übergabemechanismus + Timeout wie gemini.js, aber einen eigenen, viel
// kürzeren Prompt ohne Katalogbezug.
import { GoogleGenerativeAI } from '@google/generative-ai';
import { withTimeout } from '../withTimeout.js';

export const modelName = 'gemini-flash-latest';

const PROMPT = `Du liest ein beliebiges Geschäftsdokument (Foto oder PDF-Scan) einer Gebäudereinigungsfirma aus - z.B. ein Schlüsselübergabeprotokoll, einen unterschriebenen Vertrag, eine Rechnung oder eine sonstige Unterlage.

Extrahiere NUR folgende Angaben, so wie sie im Dokument stehen (nicht interpretieren/ergänzen):
- kundenname: Name der Firma/Person, auf die sich das Dokument bezieht (z.B. aus Adressfeld, Betreffzeile, Unterschrift)
- objektadresse: Straße + Ort des betroffenen Objekts, falls angegeben
- dokumenttyp: kurze Bezeichnung, was für ein Dokument das ist (z.B. "Schlüsselübergabeprotokoll", "Reinigungsvertrag", "Rechnung")
- datum: Datum des Dokuments im Format TT.MM.JJJJ, falls angegeben

Antworte AUSSCHLIESSLICH als valides JSON, kein Markdown, keine Erklärungen:
{
  "kundenname": "erkannter Name oder null",
  "objektadresse": "erkannte Adresse oder null",
  "dokumenttyp": "erkannter Dokumenttyp oder null",
  "datum": "erkanntes Datum oder null"
}
Wenn ein Feld nicht sicher erkennbar ist, setze null statt zu raten.`;

export async function extractInboxDocument({ fileBuffer, mimeType }) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY ist nicht konfiguriert');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: modelName });

  const result = await withTimeout(
    model.generateContent([PROMPT, { inlineData: { data: fileBuffer.toString('base64'), mimeType } }]),
    90000,
    'Gemini'
  );

  const text = result?.response?.text() || '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  let parsed;
  try {
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (err) {
    throw new Error(`Antwort des Modells war kein gültiges JSON: ${err.message}`);
  }

  return {
    kundenname: parsed.kundenname || null,
    objektadresse: parsed.objektadresse || null,
    dokumenttyp: parsed.dokumenttyp || null,
    datum: parsed.datum || null,
  };
}

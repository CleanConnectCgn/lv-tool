// Auslese-Adapter für den Vertrags-Import (Analog zu Block 7, aber ohne
// Katalog-Zuordnung - hier werden keine LV-Positionen erkannt, sondern die
// Kopfdaten eines bestehenden Reinigungsvertrags (PDF/Foto) für das
// Vertragsformular (DbContractForm.jsx) vorausgefüllt. Wie bei Block 7 wird
// NIE automatisch ein Vertrag angelegt - das Ergebnis füllt nur das
// Formular, ein Mensch prüft und bestätigt vor "Vertrag erstellen".
import { GoogleGenerativeAI } from '@google/generative-ai';
import { geminiMitRetry, GEMINI_MODELLE } from '../geminiCall.js';
import { geminiErrorMessage } from './geminiError.js';
import { BRANCHEN, DSGVO_VARIANTEN } from '../render/contractFields.js';

// Erstes Modell der Kette; bei Überlastung weicht geminiMitRetry auf die
// nächsten aus (siehe server/lib/geminiCall.js).
export const modelName = GEMINI_MODELLE[0];

const PRICE_PER_1M_INPUT_TOKENS = 0.075;
const PRICE_PER_1M_OUTPUT_TOKENS = 0.3;

export function estimateCostUsd(usage) {
  if (!usage) return null;
  const inputCost = ((usage.promptTokenCount || 0) / 1_000_000) * PRICE_PER_1M_INPUT_TOKENS;
  const outputCost = ((usage.candidatesTokenCount || 0) / 1_000_000) * PRICE_PER_1M_OUTPUT_TOKENS;
  return Math.round((inputCost + outputCost) * 100000) / 100000;
}

const BRANCHEN_KEYS = BRANCHEN.map((b) => b.key);
const DSGVO_KEYS = Object.keys(DSGVO_VARIANTEN);

function buildPrompt() {
  return `Du liest einen bestehenden Reinigungsvertrag (PDF-Scan oder Foto) aus und extrahierst NUR die folgenden Kopfdaten, die später in ein Vertragsformular übernommen werden. Du erfindest KEINE Werte - wenn eine Angabe im Dokument nicht eindeutig zu finden ist, gib null (bzw. "" für Text) zurück.

Antworte AUSSCHLIESSLICH als valides JSON, kein Markdown, keine Erklärungen, exakt in diesem Schema:
{
  "erkannteKundenfirma": "Firmenname des Auftraggebers, wörtlich wie im Dokument",
  "objektAdresse": "Adresse des zu reinigenden Objekts, falls abweichend von der Kundenadresse genannt, sonst \"\"",
  "branche": "einer aus [${BRANCHEN_KEYS.join(', ')}] - am besten passend zur erkennbaren Tätigkeit/Branche des Kunden, sonst \"sonstiges\"",
  "leistungsart": "z.B. Unterhaltsreinigung",
  "reinigungsintervall": "z.B. \"2x wöchentlich\" - wörtlich wie im Dokument formuliert",
  "verguetungNetto": Zahl (monatliches Pauschalhonorar netto in EUR, ohne MwSt.) oder null,
  "vertragsbeginn": "YYYY-MM-DD" oder null,
  "kuendigungsfristMonate": Zahl oder null,
  "laufzeitMonate": Zahl oder null (nur falls eine feste Laufzeit genannt ist, nicht bei "unbestimmte Zeit"),
  "zahlungszielWerktage": Zahl (Zahlungsziel in Tagen) oder null,
  "internerAnsprechpartner": "Name des im Vertrag genannten Ansprechpartners auf Auftragnehmer-Seite" oder "",
  "dsgvoVariante": "einer aus [${DSGVO_KEYS.join(', ')}] - wähle anhand des im Dokument erkennbaren Datenschutz-/AVV-Textes, sonst \"standard\"",
  "angebotNummer": "im Vertrag referenzierte Angebotsnummer (Anlage 2)" oder "",
  "angebotDatum": "YYYY-MM-DD" oder null
}`;
}

export async function extract({ fileBuffer, mimeType }) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY ist nicht konfiguriert');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  let result;
  try {
    result = await geminiMitRetry(
      (modell) =>
        genAI
          .getGenerativeModel({ model: modell })
          .generateContent([buildPrompt(), { inlineData: { data: fileBuffer.toString('base64'), mimeType } }]),
      { timeoutMs: 90000 }
    );
  } catch (err) {
    throw new Error(geminiErrorMessage(err));
  }

  const text = result?.response?.text() || '{}';
  const usage = result?.response?.usageMetadata || null;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  let parsed;
  try {
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (err) {
    throw new Error(`Antwort des Modells war kein gültiges JSON: ${err.message}`);
  }

  return { draft: sanitizeDraft(parsed), usage };
}

// Reine Validierungslogik ohne I/O, separat testbar (gleiches Muster wie
// validateExtraction in extraction/index.js): eine vom Modell erfundene
// branche/dsgvoVariante außerhalb der bekannten Optionen wird auf den
// sicheren Standardwert zurückgesetzt statt ungeprüft übernommen -
// serverseitig ERZWUNGEN, nicht nur per Prompt erhofft.
export function sanitizeDraft(parsed) {
  const branche = BRANCHEN_KEYS.includes(parsed?.branche) ? parsed.branche : 'sonstiges';
  const dsgvoVariante = DSGVO_KEYS.includes(parsed?.dsgvoVariante) ? parsed.dsgvoVariante : 'standard';

  return {
    erkannteKundenfirma: parsed?.erkannteKundenfirma || '',
    objektAdresse: parsed?.objektAdresse || '',
    branche,
    leistungsart: parsed?.leistungsart || '',
    reinigungsintervall: parsed?.reinigungsintervall || '',
    verguetungNetto: typeof parsed?.verguetungNetto === 'number' ? parsed.verguetungNetto : null,
    vertragsbeginn: parsed?.vertragsbeginn || null,
    kuendigungsfristMonate: typeof parsed?.kuendigungsfristMonate === 'number' ? parsed.kuendigungsfristMonate : null,
    laufzeitMonate: typeof parsed?.laufzeitMonate === 'number' ? parsed.laufzeitMonate : null,
    zahlungszielWerktage: typeof parsed?.zahlungszielWerktage === 'number' ? parsed.zahlungszielWerktage : null,
    internerAnsprechpartner: parsed?.internerAnsprechpartner || '',
    dsgvoVariante,
    angebotNummer: parsed?.angebotNummer || '',
    angebotDatum: parsed?.angebotDatum || null,
  };
}

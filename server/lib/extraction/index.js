// Austauschbarer Auslese-Adapter (Block 7). Anbieterwahl AUSSCHLIESSLICH
// über die Umgebungsvariable EXTRACTION_PROVIDER (Standard: "gemini") - ein
// Wechsel ist eine Konfigurationsänderung, kein Codeumbau. Neue Anbieter
// werden hier nur in die PROVIDERS-Map ergänzt, sonst nichts.
import * as geminiProvider from './gemini.js';

const PROVIDERS = { gemini: geminiProvider };

// Reine Validierungslogik ohne I/O, separat testbar: "Das Modell legt
// niemals selbst einen Katalogpunkt an" ist eine harte Regel - wird hier
// serverseitig ERZWUNGEN, nicht nur per Prompt erhofft. Jede vom Modell
// zurückgegebene catalogItemId, die nicht im tatsächlich übergebenen Katalog
// vorkommt, wird automatisch nach "unmatched" verschoben.
export function validateExtraction(raw, catalog) {
  const validCatalogIds = new Set(catalog.map((c) => c.id));
  const matched = [];
  const unmatched = [...(raw.unmatched || []).map((u) => ({ originalText: u.originalText || '' }))];

  for (const row of raw.matched || []) {
    if (!row?.catalogItemId || !validCatalogIds.has(row.catalogItemId)) {
      unmatched.push({ originalText: row?.originalText || '', reason: 'invalid_catalog_id_from_model' });
      continue;
    }
    // "einmalig" ergänzt 2026-07-30: fehlte hier komplett, obwohl die
    // manuelle Neuanlage (DbObjectDetail.jsx) den Wert bereits kannte -
    // eine per Foto/PDF importierte einmalige Leistung wäre sonst
    // stillschweigend falsch als "kein Intervall gesetzt" durchgereicht
    // worden, exakt die Notlösungs-Problematik, die einmalig eigentlich lösen sollte.
    const intervalFieldsSet = ['nachBedarf', 'einmalig', 'woechentlich', 'monatlich', 'jaehrlich'].filter((k) => {
      const v = row[k];
      return k === 'nachBedarf' || k === 'einmalig' ? v === true : v !== null && v !== undefined && v !== '';
    }).length;

    matched.push({
      originalText: row.originalText || '',
      catalogItemId: row.catalogItemId,
      nachBedarf: !!row.nachBedarf,
      einmalig: !!row.einmalig,
      woechentlich: row.woechentlich ?? null,
      monatlich: row.monatlich ?? null,
      jaehrlich: row.jaehrlich ?? null,
      bemerkung: row.bemerkung || '',
      // "Schema prüfen, fehlende Pflichtfelder markieren": roomAreaId setzt
      // das Modell nie (Raumbereich wird laut Block 5 erst beim Anlegen des
      // ServiceSpecItem von einem Menschen gewählt), interval fehlt/ist
      // mehrdeutig, wenn nicht genau ein Intervallfeld gesetzt ist.
      missingFields: ['roomAreaId', ...(intervalFieldsSet === 1 ? [] : ['interval'])],
    });
  }

  return { matched, unmatched };
}

export async function extractDocument({ fileBuffer, mimeType, catalog }) {
  const providerName = process.env.EXTRACTION_PROVIDER || 'gemini';
  const provider = PROVIDERS[providerName];
  if (!provider) throw new Error(`Unbekannter EXTRACTION_PROVIDER: "${providerName}"`);

  const start = Date.now();
  const raw = await provider.extract({ fileBuffer, mimeType, catalog });
  const durationMs = Date.now() - start;

  const { matched, unmatched } = validateExtraction(raw, catalog);

  const logEntry = {
    provider: providerName,
    model: provider.modelName,
    durationMs,
    estimatedCostUsd: provider.estimateCostUsd ? provider.estimateCostUsd(raw.usage) : null,
    matchedCount: matched.length,
    unmatchedCount: unmatched.length,
    timestamp: new Date().toISOString(),
  };
  // "Jeder Aufruf wird mit Modell, Dauer und Kosten protokolliert."
  console.log('[Auslesung]', JSON.stringify(logEntry));

  return { matched, unmatched, log: logEntry };
}

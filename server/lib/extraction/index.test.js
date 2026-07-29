import { describe, it, expect } from 'vitest';
import fs from 'fs/promises';
import { validateExtraction, extractDocument } from './index.js';

const CATALOG = [
  { id: 'cat-1', gegenstand: 'Hartboden', verb: 'FEUCHT_WISCHEN' },
  { id: 'cat-2', gegenstand: 'Abfallbehälter', verb: 'ENTLEEREN_UND_ENTSORGEN' },
];

describe('validateExtraction (reine Logik, kein I/O)', () => {
  it('übernimmt gültige Katalog-Treffer unverändert', () => {
    const raw = {
      matched: [{ originalText: 'Boden wischen', catalogItemId: 'cat-1', woechentlich: 2 }],
      unmatched: [],
    };
    const { matched, unmatched } = validateExtraction(raw, CATALOG);
    expect(matched).toHaveLength(1);
    expect(matched[0].catalogItemId).toBe('cat-1');
    expect(unmatched).toHaveLength(0);
  });

  it('verschiebt eine vom Modell erfundene catalogItemId nach unmatched statt sie zu übernehmen', () => {
    const raw = {
      matched: [{ originalText: 'Erfundene Leistung', catalogItemId: 'nicht-im-katalog-vorhanden', woechentlich: 1 }],
      unmatched: [],
    };
    const { matched, unmatched } = validateExtraction(raw, CATALOG);
    expect(matched).toHaveLength(0);
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].reason).toBe('invalid_catalog_id_from_model');
    expect(unmatched[0].originalText).toBe('Erfundene Leistung');
  });

  it('markiert roomAreaId immer als fehlendes Pflichtfeld (Modell setzt es nie)', () => {
    const raw = { matched: [{ originalText: 'x', catalogItemId: 'cat-1', woechentlich: 1 }], unmatched: [] };
    const { matched } = validateExtraction(raw, CATALOG);
    expect(matched[0].missingFields).toContain('roomAreaId');
  });

  it('markiert "interval" als fehlend, wenn nicht genau ein Intervallfeld gesetzt ist', () => {
    const rawNone = { matched: [{ originalText: 'x', catalogItemId: 'cat-1' }], unmatched: [] };
    expect(validateExtraction(rawNone, CATALOG).matched[0].missingFields).toContain('interval');

    const rawMultiple = {
      matched: [{ originalText: 'x', catalogItemId: 'cat-1', woechentlich: 1, monatlich: 2 }],
      unmatched: [],
    };
    expect(validateExtraction(rawMultiple, CATALOG).matched[0].missingFields).toContain('interval');

    const rawExactlyOne = { matched: [{ originalText: 'x', catalogItemId: 'cat-1', jaehrlich: 1 }], unmatched: [] };
    expect(validateExtraction(rawExactlyOne, CATALOG).matched[0].missingFields).not.toContain('interval');
  });

  it('übernimmt "einmalig" korrekt und zählt es als gültiges Intervallfeld (Regressionstest)', () => {
    // Ergänzt 2026-07-30: "einmalig" fehlte hier komplett, obwohl die
    // manuelle Neuanlage es bereits kannte - eine per Foto/PDF importierte
    // einmalige Leistung wäre sonst fälschlich als "kein Intervall gesetzt"
    // markiert worden.
    const raw = { matched: [{ originalText: 'Einmalige Grundreinigung', catalogItemId: 'cat-1', einmalig: true }], unmatched: [] };
    const { matched } = validateExtraction(raw, CATALOG);
    expect(matched[0].einmalig).toBe(true);
    expect(matched[0].missingFields).not.toContain('interval');
  });

  it('lässt unmatched-Zeilen unverändert durch', () => {
    const raw = { matched: [], unmatched: [{ originalText: 'Komische Sonderleistung' }] };
    const { unmatched } = validateExtraction(raw, CATALOG);
    expect(unmatched).toEqual([{ originalText: 'Komische Sonderleistung' }]);
  });
});

// /tmp/test-lv.pdf ist eine lokal (manuell) heruntergeladene, echte
// Produktiv-PDF - existiert nur auf dieser Entwicklungsmaschine, NICHT in
// CI/anderen Umgebungen. Dieser Test überspringt sich daher selbst, wenn
// die Datei fehlt, statt mit ENOENT hart zu scheitern.
const TEST_PDF_PATH = '/tmp/test-lv.pdf';

describe('extractDocument (live gegen die echte Gemini-API)', () => {
  it('liest ein echtes, produktives Leistungsverzeichnis-PDF aus und ordnet Positionen dem Katalog zu', async () => {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY nicht gesetzt - überspringe Live-Test');
      return;
    }
    const fileBuffer = await fs.readFile(TEST_PDF_PATH).catch(() => null);
    if (!fileBuffer) {
      console.warn(`${TEST_PDF_PATH} nicht vorhanden - überspringe Live-Test (nur auf dieser Maschine verfügbar)`);
      return;
    }
    // Realer, in Block 5 geseedeter Katalog-Ausschnitt (Hartboden/Abfallbehälter
    // kommen in praktisch jedem Unterhaltsreinigungs-LV vor).
    const catalog = [
      { id: 'boden-hartboden', gegenstand: 'Hartboden', verb: 'FEUCHT_WISCHEN' },
      { id: 'abfall-behaelter', gegenstand: 'Abfallbehälter', verb: 'ENTLEEREN_UND_ENTSORGEN', zusatz: 'inkl. Austausch der Beutel' },
      { id: 'wand-tuerklinken', gegenstand: 'Türklinken', verb: 'GRIFFSPUREN_ENTFERNEN' },
    ];

    let result;
    try {
      result = await extractDocument({ fileBuffer, mimeType: 'application/pdf', catalog });
    } catch (err) {
      // Freies Gemini-Kontingent ist auf 20 Anfragen/Tag begrenzt - bei
      // ausgeschöpftem Kontingent ist das eine externe, erwartbare
      // Einschränkung, kein Fehler in diesem Adapter. Test überspringt sich
      // dann selbst statt fälschlich als Codefehler durchzugehen.
      if (String(err?.message).includes('429') || String(err?.message).toLowerCase().includes('quota')) {
        console.warn('Gemini-Kontingent ausgeschöpft - überspringe Live-Test:', err.message);
        return;
      }
      throw err;
    }

    expect(result.log.model).toBe('gemini-flash-latest');
    expect(result.log.durationMs).toBeGreaterThan(0);
    expect(Array.isArray(result.matched)).toBe(true);
    expect(Array.isArray(result.unmatched)).toBe(true);
    // Jede zurückgegebene ID muss zwingend im übergebenen Katalog stecken -
    // die zentrale Sicherheitsgarantie dieses Blocks.
    const validIds = new Set(catalog.map((c) => c.id));
    result.matched.forEach((m) => expect(validIds.has(m.catalogItemId)).toBe(true));
  }, 60000);
});

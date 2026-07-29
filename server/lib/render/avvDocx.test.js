import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildAvvDocument } from './avvDocx.js';

async function extractDocumentXml(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  return zip.file('word/document.xml').async('string');
}

const BASE = {
  kunde: { firma: 'Praxis Musterfrau' },
  vertragsnummer: 'VT-2001',
  datum: '2026-07-29',
  dsgvoVariante: 'gesundheitsdaten',
};

describe('buildAvvDocument', () => {
  it('erzeugt ein gültiges DOCX für eine AVV-pflichtige Variante', async () => {
    const buffer = await buildAvvDocument(BASE);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    const xml = await extractDocumentXml(buffer);
    expect(xml).toContain('Praxis Musterfrau');
    expect(xml).toContain('VT-2001');
    expect(xml).toContain('Vereinbarung zur Auftragsverarbeitung');
  });

  it('enthält die Pflichtangaben nach Art. 28 Abs. 3 DSGVO (Gliederungspunkte)', async () => {
    const xml = await extractDocumentXml(await buildAvvDocument(BASE));
    for (const abschnitt of [
      'Gegenstand und Dauer der Verarbeitung',
      'Weisungsgebundenheit',
      'Vertraulichkeit',
      'Technische und organisatorische Maßnahmen',
      'Unterauftragsverarbeiter',
      'Löschung und Rückgabe',
      'Kontrollrechte',
    ]) {
      expect(xml).toContain(abschnitt);
    }
  });

  it('nutzt die Kategorien betroffener Personen aus AVV_VARIANTEN', async () => {
    const xml = await extractDocumentXml(await buildAvvDocument(BASE));
    expect(xml).toContain('Patientinnen und Patienten');
  });

  it('wirft für Varianten ohne AVV-Pflicht (z.B. standard)', () => {
    expect(() => buildAvvDocument({ ...BASE, dsgvoVariante: 'standard' })).toThrow(/keine AVV erforderlich/);
  });

  it('wirft für unbekannte oder entfernte Varianten (z.B. ehemals Kanzlei/Kindergarten)', () => {
    // Bewusst nur 2 DSGVO-Varianten (Standard/Erhöhter Schutz) statt vieler
    // Branchen-Einzelvarianten - Kanzlei/Kindergarten wurden entfernt, da
    // keine echte Kundengruppe (Entscheidung 2026-07-29). Ein alter,
    // gespeicherter Contract mit so einem Schlüssel darf keine AVV mehr
    // erzeugen, statt mit einer falschen/leeren Vorlage weiterzumachen.
    for (const variante of ['unbekannt', 'mandantendaten', 'minderjaehrige']) {
      expect(() => buildAvvDocument({ ...BASE, dsgvoVariante: variante })).toThrow();
    }
  });
});

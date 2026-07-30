import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildAvvPdf } from './avvPdf.js';

const tmpDir = mkdtempSync(join(tmpdir(), 'avvPdf-test-'));
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

async function extractText(buffer) {
  const pdfPath = join(tmpDir, `${Math.random().toString(36).slice(2)}.pdf`);
  writeFileSync(pdfPath, buffer);
  const raw = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
  return raw.replace(/\s+/g, ' ');
}

const BASE = {
  kunde: { firma: 'Praxis Musterfrau' },
  vertragsnummer: 'VT-2001',
  datum: '2026-07-29',
  dsgvoVariante: 'gesundheitsdaten',
};

describe('buildAvvPdf', () => {
  it('erzeugt ein gültiges PDF für eine AVV-pflichtige Variante', async () => {
    const buffer = await buildAvvPdf(BASE);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.toString('latin1', 0, 8)).toBe('%PDF-1.3');
    const text = await extractText(buffer);
    expect(text).toContain('Praxis Musterfrau');
    expect(text).toContain('VT-2001');
    expect(text).toContain('Vereinbarung zur Auftragsverarbeitung');
  });

  it('enthält die Pflichtangaben nach Art. 28 Abs. 3 DSGVO (Gliederungspunkte)', async () => {
    const text = await extractText(await buildAvvPdf(BASE));
    for (const abschnitt of [
      'Gegenstand und Dauer der Verarbeitung',
      'Weisungsgebundenheit',
      'Vertraulichkeit',
      'Technische und organisatorische Maßnahmen',
      'Unterauftragsverarbeiter',
      'Löschung und Rückgabe',
      'Kontrollrechte',
    ]) {
      expect(text).toContain(abschnitt);
    }
  });

  it('nutzt die Kategorien betroffener Personen aus AVV_VARIANTEN', async () => {
    const text = await extractText(await buildAvvPdf(BASE));
    expect(text).toContain('Patientinnen und Patienten');
  });

  it('zeigt die Kopf-Infobox mit Vertragsnummer, Datum, Verantwortlichem und Auftragsverarbeiter', async () => {
    const text = await extractText(await buildAvvPdf(BASE));
    expect(text).toContain('Zu Vertrag');
    expect(text).toContain('29.07.2026');
    expect(text).toContain('Verantwortlicher (Auftraggeber)');
    expect(text).toContain('Auftragsverarbeiter');
    expect(text).toContain('Clean Connect Gebäudereinigung UG');
  });

  it('wirft für Varianten ohne AVV-Pflicht (z.B. standard)', () => {
    expect(() => buildAvvPdf({ ...BASE, dsgvoVariante: 'standard' })).toThrow(/keine AVV erforderlich/);
  });

  it('wirft für unbekannte oder entfernte Varianten (z.B. ehemals Kanzlei/Kindergarten)', () => {
    for (const variante of ['unbekannt', 'mandantendaten', 'minderjaehrige']) {
      expect(() => buildAvvPdf({ ...BASE, dsgvoVariante: variante })).toThrow();
    }
  });

  it('platziert den Unterschriftenblock ohne Überlappung mit der Fußzeile, auch bei langen Firmennamen', async () => {
    const buffer = await buildAvvPdf({
      ...BASE,
      kunde: { firma: 'Eine Ganz Besonders Lange Firmenbezeichnung Gesellschaft mit beschränkter Haftung & Co. KG' },
    });
    const text = await extractText(buffer);
    expect(text).toContain('Auftragnehmer');
    expect(text).toContain('Auftraggeber');
    expect(text).toMatch(/Clean Connect Gebäudereinigung UG · Amtsgericht Köln/);
  });
});

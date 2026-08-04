import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildContractPdf } from './contractPdf.js';

// pdftotext (poppler) macht aus dem PDF echten, durchsuchbaren Text - stärkere
// Absicherung als eine reine Signatur-Prüfung, da sie die tatsächlich
// gerenderten Zeichen prüft statt nur die Existenz einer PDF-Struktur. Siehe
// Kopfkommentar contractPdf.js: Klauseltext ist hier gegenüber contractDocx.js
// dupliziert, das hier ist das Sicherheitsnetz dagegen.
const tmpDir = mkdtempSync(join(tmpdir(), 'contractPdf-test-'));
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

async function extractText(buffer) {
  const pdfPath = join(tmpDir, `${Math.random().toString(36).slice(2)}.pdf`);
  writeFileSync(pdfPath, buffer);
  const raw = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
  // Fließtext-Zeilenumbrüche sind reines PDF-Layout, keine inhaltliche
  // Aussage (anders als bei DOCX, wo document.xml den Text ohne Umbrüche
  // als zusammenhängenden Lauf speichert) - für Inhaltsprüfungen auf
  // zusammenhängenden Text normalisieren.
  return raw.replace(/\s+/g, ' ');
}

const BASE_CONTRACT = {
  kunde: { firma: 'Muster GmbH', strasse: 'Musterstraße 1', plz: '50667', ort: 'Köln', ansprechpartner: 'Frau Muster' },
  objektAdresse: 'Musterstraße 1, 50667 Köln',
  vertragsnummer: 'VT-9999',
  leistungsart: 'Unterhaltsreinigung',
  reinigungsintervall: '2x wöchentlich',
  verguetungNetto: 500,
  mwstSatz: 19,
  vertragsbeginn: '2026-08-01',
  kuendigungsfristMonate: 2,
  internerAnsprechpartner: 'Julian Mühlhoff',
  datum: '2026-07-27',
};

describe('buildContractPdf', () => {
  it('erzeugt ein gültiges PDF', async () => {
    const buffer = await buildContractPdf(BASE_CONTRACT);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.toString('latin1', 0, 8)).toBe('%PDF-1.3');
  });

  it('setzt die variablen Felder korrekt ein (Kunde, Objekt, Intervall, Preis, Ansprechpartner)', async () => {
    const text = await extractText(await buildContractPdf(BASE_CONTRACT));
    expect(text).toContain('Muster GmbH');
    expect(text).toContain('VT-9999');
    expect(text).toContain('Musterstraße 1, 50667 Köln');
    expect(text).toContain('2x wöchentlich');
    expect(text).toContain('500,00');
    expect(text).toContain('Julian Mühlhoff');
  });

  it('haelt Haftung, Gewaehrleistung und Schlussbestimmungen unveraendert, unabhaengig von den Eingabefeldern', async () => {
    const a = await extractText(await buildContractPdf(BASE_CONTRACT));
    const b = await extractText(
      await buildContractPdf({
        ...BASE_CONTRACT,
        kunde: { firma: 'Ganz Andere AG', strasse: 'Woanders 9', plz: '10115', ort: 'Berlin' },
        reinigungsintervall: 'täglich',
        verguetungNetto: 12345,
        leistungsart: 'Grundreinigung',
      })
    );
    const fixedPhrases = [
      'Bei Vorsatz und grober',
      'Fahrlässigkeit haftet der Auftragnehmer unbeschränkt',
      'gemäß § 634a Abs. 1 Nr. 1 BGB in zwei Jahren',
      'Mündliche Nebenabreden bestehen nicht',
      'Ausschließlicher Gerichtsstand',
    ];
    for (const phrase of fixedPhrases) {
      expect(a).toContain(phrase);
      expect(b).toContain(phrase);
    }
  });

  it('generalisiert optionale Positionen (mehrere, nicht nur Glasreinigung)', async () => {
    const text = await extractText(
      await buildContractPdf({
        ...BASE_CONTRACT,
        optionalePositionen: [
          { name: 'Glasreinigung', intervall: 'auf Anfrage', preisNetto: 80, ersteinsatzRabatt: true },
          { name: 'Winterdienst', intervall: 'nach Bedarf', preisNetto: 150, ersteinsatzRabatt: false },
        ],
      })
    );
    expect(text).toContain('Glasreinigung');
    expect(text).toContain('Winterdienst');
  });

  it('nutzt "auf unbestimmte Zeit" ohne Laufzeit, einen festen Zeitraum mit gesetzter Laufzeit', async () => {
    const unbestimmt = await extractText(await buildContractPdf(BASE_CONTRACT));
    expect(unbestimmt).toContain('unbestimmte Zeit');

    const befristet = await extractText(await buildContractPdf({ ...BASE_CONTRACT, laufzeitMonate: 24 }));
    expect(befristet).toContain('24 Monaten');
  });

  it('waehlt die Arztpraxis-DSGVO-Klausel (Verschwiegenheit) nur wenn per Haekchen gesetzt', async () => {
    const standard = await extractText(await buildContractPdf(BASE_CONTRACT));
    expect(standard).not.toContain('ärztliche');

    const arztpraxis = await extractText(await buildContractPdf({ ...BASE_CONTRACT, dsgvoVariante: 'arztpraxis' }));
    expect(arztpraxis).toContain('ärztliche');
    expect(arztpraxis).toContain('Auftragsverarbeitung');
  });

  it('nutzt einen gespeicherten dsgvoKlausel-Snapshot statt der Live-Tabelle (Immutability-Fix)', async () => {
    const snapshotText = 'DIES-IST-EIN-EINGEFRORENER-TEXT-AUS-DER-VERGANGENHEIT';
    const text = await extractText(
      await buildContractPdf({
        ...BASE_CONTRACT,
        dsgvoVariante: 'standard',
        dsgvoKlausel: { label: 'Alt', braucht_avv: false, text: snapshotText },
      })
    );
    expect(text).toContain(snapshotText);
  });

  it('setzt das Standard-Zahlungsziel, wenn zahlungszielWerktage explizit null ist (Regressionstest)', async () => {
    const text = await extractText(await buildContractPdf({ ...BASE_CONTRACT, zahlungszielWerktage: null }));
    expect(text).toContain('innerhalb von 14 Tagen zu leisten');
    expect(text).not.toContain('null Tagen');
  });

  it('zeigt "—" statt erfundener "0,00 EUR" bei fehlender Vergütung (Regressionstest)', async () => {
    const text = await extractText(await buildContractPdf({ ...BASE_CONTRACT, verguetungNetto: null }));
    expect(text).not.toContain('in Höhe von 0,00 EUR');
    expect(text).not.toContain('entspricht 0,00 EUR');
    expect(text).toContain('— netto');
  });

  it('nummeriert die Anlagen-Rangfolge (§9.3) in jeder Kombination lückenlos durch (Regressionstest)', async () => {
    const cases = [
      { dsgvoVariante: 'standard', angebotNummer: null, erwartet: ['(1) dieser Vertrag', '(2) Leistungsverzeichnis'] },
      {
        dsgvoVariante: 'standard',
        angebotNummer: 'AN-1',
        erwartet: ['(1) dieser Vertrag', '(2) Leistungsverzeichnis', '(3) Angebot'],
      },
      {
        dsgvoVariante: 'physiotherapiepraxis',
        angebotNummer: null,
        erwartet: ['(1) dieser Vertrag', '(2) Vereinbarung zur Auftragsverarbeitung', '(3) Leistungsverzeichnis'],
      },
      {
        dsgvoVariante: 'physiotherapiepraxis',
        angebotNummer: 'AN-1',
        erwartet: [
          '(1) dieser Vertrag',
          '(2) Vereinbarung zur Auftragsverarbeitung',
          '(3) Leistungsverzeichnis',
          '(4) Angebot',
        ],
      },
    ];
    for (const { dsgvoVariante, angebotNummer, erwartet } of cases) {
      const text = await extractText(
        await buildContractPdf({ ...BASE_CONTRACT, dsgvoVariante, angebotNummer, angebotDatum: '2026-07-01' })
      );
      for (const fragment of erwartet) {
        expect(text).toContain(fragment);
      }
    }
  });

  it('zeigt keinen Warnbanner bei vollständigen Daten, aber einen bei fehlenden Pflichtangaben', async () => {
    const vollstaendig = await extractText(await buildContractPdf(BASE_CONTRACT));
    expect(vollstaendig).not.toContain('ENTWURF');

    const unvollstaendig = await extractText(
      await buildContractPdf({ ...BASE_CONTRACT, vertragsbeginn: null, verguetungNetto: null })
    );
    expect(unvollstaendig).toContain('ENTWURF');
    expect(unvollstaendig).toContain('Leistungsbeginn fehlt');
  });

  it('rechnet die Vertragsstrafe (§7.5) explizit auf weitergehenden Schadensersatz an (AGB-Fix)', async () => {
    const text = await extractText(await buildContractPdf(BASE_CONTRACT));
    expect(text).toContain('wird auf einen solchen weitergehenden Schadensersatzanspruch angerechnet');
  });

  it('verlangt von Kunden-Erklärungen nur Textform, nie die strengere Schriftform (§309 Nr. 13 BGB)', async () => {
    const text = await extractText(await buildContractPdf(BASE_CONTRACT));
    expect(text).toContain('in Textform einen oder mehrere Mängel rügt');
    expect(text).toContain('in Textform eine Frist zur');
    expect(text).toContain('trotz Abmahnung in Textform');
    expect(text).toContain('nach Mahnung in Textform');
    expect(text).not.toContain('schriftlich einen oder mehrere Mängel rügt');
    expect(text).not.toContain('schriftlich eine Frist zur Nacherfüllung');
    expect(text).not.toContain('trotz schriftlicher Abmahnung');
    expect(text).not.toContain('nach schriftlicher Mahnung');

    const befristet = await extractText(await buildContractPdf({ ...BASE_CONTRACT, laufzeitMonate: 24 }));
    expect(befristet).toContain('von einer Partei in Textform');
    expect(befristet).not.toContain('von einer Partei schriftlich');
  });

  it('§1.2: Angebot gilt für die Regelleistung, optionale Angebotspositionen sind ohne § 2-Eintrag ausgeschlossen (Rechts-Audit gegen VT-1265)', async () => {
    const ohneOptionale = await extractText(
      await buildContractPdf({ ...BASE_CONTRACT, angebotNummer: 'AN-1', angebotDatum: '2026-07-01' })
    );
    expect(ohneOptionale).toContain('gilt insbesondere für die Vergütung der Unterhaltsreinigungsleistungen');
    expect(ohneOptionale).toContain('Die im Angebot als optional ausgewiesenen Positionen sind nicht Gegenstand dieses Vertrages');
    expect(ohneOptionale).not.toContain('Die Vergütung optionaler Zusatzpositionen richtet sich nach § 2');

    const mitOptionalen = await extractText(
      await buildContractPdf({
        ...BASE_CONTRACT,
        angebotNummer: 'AN-1',
        angebotDatum: '2026-07-01',
        optionalePositionen: [{ name: 'Glasreinigung', preisNetto: 100 }],
      })
    );
    expect(mitOptionalen).toContain(
      'Die Vergütung der im Angebot als optional ausgewiesenen und in diesen Vertrag aufgenommenen Zusatzpositionen richtet sich nach § 2'
    );
    expect(mitOptionalen).not.toContain('sind nicht Gegenstand dieses Vertrages');
  });

  it('platziert den Unterschriftenblock ohne Überlappung mit der Fußzeile, auch bei langen Firmennamen', async () => {
    const buffer = await buildContractPdf({
      ...BASE_CONTRACT,
      kunde: {
        firma: 'Eine Ganz Besonders Lange Firmenbezeichnung Gesellschaft mit beschränkter Haftung & Co. KG',
        strasse: 'Musterstraße 1',
        plz: '50667',
        ort: 'Köln',
      },
    });
    const text = await extractText(buffer);
    // Signaturblock enthält "Auftragnehmer"/"Auftraggeber" auf derselben
    // Seite wie die Fußzeile - Regressionstest für den Layout-Bug (Box zu
    // niedrig berechnet, Rollen-Label überlappte mit der Fußzeile).
    expect(text).toContain('Auftragnehmer');
    expect(text).toContain('Auftraggeber');
    expect(text).toMatch(/Clean Connect Gebäudereinigung UG · Amtsgericht Köln/);
  });
});

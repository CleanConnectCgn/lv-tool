import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildContractDocument } from './contractDocx.js';

async function extractDocumentXml(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  return zip.file('word/document.xml').async('string');
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

describe('buildContractDocument', () => {
  it('erzeugt ein gültiges DOCX (ZIP mit word/document.xml)', async () => {
    const buffer = await buildContractDocument(BASE_CONTRACT);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    const xml = await extractDocumentXml(buffer);
    expect(xml).toContain('Muster GmbH');
    expect(xml).toContain('VT-9999');
  });

  it('setzt die variablen Felder korrekt ein (Kunde, Objekt, Intervall, Preis, Ansprechpartner)', async () => {
    const buffer = await buildContractDocument(BASE_CONTRACT);
    const xml = await extractDocumentXml(buffer);
    expect(xml).toContain('Musterstraße 1, 50667 Köln');
    expect(xml).toContain('2x wöchentlich');
    expect(xml).toContain('500,00');
    expect(xml).toContain('Julian Mühlhoff');
    expect(xml).toContain('Frau Muster');
  });

  it('nutzt die Standard-Ueberschrift, wenn keine gesetzt ist, und eine eigene, wenn angegeben', async () => {
    const standard = await extractDocumentXml(await buildContractDocument(BASE_CONTRACT));
    expect(standard).toContain('Reinigungsvertrag');

    const eigen = await extractDocumentXml(
      await buildContractDocument({ ...BASE_CONTRACT, ueberschrift: 'Unterhaltsreinigungsvertrag' })
    );
    expect(eigen).toContain('Unterhaltsreinigungsvertrag');
  });

  it('haelt Haftung, Gewaehrleistung und Schlussbestimmungen unveraendert, unabhaengig von den Eingabefeldern', async () => {
    const a = await extractDocumentXml(await buildContractDocument(BASE_CONTRACT));
    const b = await extractDocumentXml(
      await buildContractDocument({
        ...BASE_CONTRACT,
        kunde: { firma: 'Ganz Andere AG', strasse: 'Woanders 9', plz: '10115', ort: 'Berlin' },
        reinigungsintervall: 'täglich',
        verguetungNetto: 12345,
        leistungsart: 'Grundreinigung',
      })
    );
    // §5 Haftung, §4 Gewährleistung, §9 Schlussbestimmungen - Kernsätze
    // müssen wortgleich in beiden Varianten vorkommen.
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
    const buffer = await buildContractDocument({
      ...BASE_CONTRACT,
      optionalePositionen: [
        { name: 'Glasreinigung', intervall: 'auf Anfrage', preisNetto: 80, ersteinsatzRabatt: true },
        { name: 'Winterdienst', intervall: 'nach Bedarf', preisNetto: 150, ersteinsatzRabatt: false },
      ],
    });
    const xml = await extractDocumentXml(buffer);
    expect(xml).toContain('Glasreinigung');
    expect(xml).toContain('Winterdienst');
  });

  it('nutzt "auf unbestimmte Zeit" ohne Laufzeit, einen festen Zeitraum mit gesetzter Laufzeit', async () => {
    const unbestimmt = await extractDocumentXml(await buildContractDocument(BASE_CONTRACT));
    expect(unbestimmt).toContain('unbestimmte Zeit');

    const befristet = await extractDocumentXml(await buildContractDocument({ ...BASE_CONTRACT, laufzeitMonate: 24 }));
    expect(befristet).toContain('24 Monaten');
  });

  it('waehlt die Arztpraxis-DSGVO-Klausel (Verschwiegenheit) nur wenn per Haekchen gesetzt', async () => {
    const standard = await extractDocumentXml(await buildContractDocument(BASE_CONTRACT));
    expect(standard).not.toContain('ärztliche');

    const arztpraxis = await extractDocumentXml(
      await buildContractDocument({ ...BASE_CONTRACT, dsgvoVariante: 'gesundheitsdaten' })
    );
    expect(arztpraxis).toContain('ärztliche');
    expect(arztpraxis).toContain('Auftragsverarbeitung');
  });

  it('nutzt einen gespeicherten dsgvoKlausel-Snapshot statt der Live-Tabelle (Immutability-Fix)', async () => {
    // Simuliert: DSGVO_VARIANTEN.standard wurde nach Vertragserstellung
    // inhaltlich geändert - der bereits erstellte Vertrag muss trotzdem den
    // ZUM ERSTELLUNGSZEITPUNKT gültigen (gespeicherten) Text zeigen.
    const snapshotText = 'DIES-IST-EIN-EINGEFRORENER-TEXT-AUS-DER-VERGANGENHEIT';
    const xml = await extractDocumentXml(
      await buildContractDocument({
        ...BASE_CONTRACT,
        dsgvoVariante: 'standard',
        dsgvoKlausel: { label: 'Alt', braucht_avv: false, text: snapshotText },
      })
    );
    expect(xml).toContain(snapshotText);
  });

  it('setzt das Standard-Zahlungsziel, wenn zahlungszielWerktage explizit null ist (Regressionstest)', async () => {
    // Bug gefunden 2026-07-29 beim Testen mit echten, aus der DB geladenen
    // Vertragsdaten: documentRoutes.js speichert ein fehlendes Zahlungsziel
    // als explizites null (nicht als fehlenden Schlüssel). Ein Destructuring-
    // Default (`= DEFAULT_WERT`) greift aber NUR bei undefined, nicht bei
    // null - Ergebnis war "innerhalb von null Werktagen zu leisten" in
    // echten Verträgen. Dieser Test bildet exakt den DB-Rundlauf nach
    // (expliziter null-Wert, kein fehlender Schlüssel).
    const xml = await extractDocumentXml(
      await buildContractDocument({ ...BASE_CONTRACT, zahlungszielWerktage: null })
    );
    expect(xml).toContain('innerhalb von 10 Werktagen zu leisten');
    expect(xml).not.toContain('null Werktagen');
  });

  it('nummeriert die Anlagen-Rangfolge (§9.3) in jeder Kombination lückenlos durch (Regressionstest)', async () => {
    // Bug gefunden 2026-07-29: bei "kein AVV, aber Angebot vorhanden" sprang
    // die Nummerierung von (2) auf (4) und übersprang (3), weil die (4) für
    // "Angebot" fest verdrahtet war statt von den vorherigen Einträgen
    // abzuhängen.
    const cases = [
      { dsgvoVariante: 'standard', angebotNummer: null, erwartet: ['(1) dieser Vertrag', '(2) Leistungsverzeichnis'] },
      {
        dsgvoVariante: 'standard',
        angebotNummer: 'AN-1',
        erwartet: ['(1) dieser Vertrag', '(2) Leistungsverzeichnis', '(3) Angebot'],
      },
      {
        dsgvoVariante: 'gesundheitsdaten',
        angebotNummer: null,
        erwartet: ['(1) dieser Vertrag', '(2) Vereinbarung zur Auftragsverarbeitung', '(3) Leistungsverzeichnis'],
      },
      {
        dsgvoVariante: 'gesundheitsdaten',
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
      const xml = await extractDocumentXml(
        await buildContractDocument({ ...BASE_CONTRACT, dsgvoVariante, angebotNummer, angebotDatum: '2026-07-01' })
      );
      for (const fragment of erwartet) {
        expect(xml).toContain(fragment);
      }
      // Es darf niemals eine Nummer übersprungen werden, egal welche
      // Kombination von Anlagen vorhanden ist.
      expect(xml).not.toMatch(/\(2\)[^(]*\(4\)/);
    }
  });

  it('zeigt keinen Warnbanner bei vollständigen Daten, aber einen bei fehlenden Pflichtangaben', async () => {
    const vollstaendig = await extractDocumentXml(await buildContractDocument(BASE_CONTRACT));
    expect(vollstaendig).not.toContain('ENTWURF');

    const unvollstaendig = await extractDocumentXml(
      await buildContractDocument({ ...BASE_CONTRACT, vertragsbeginn: null, verguetungNetto: null })
    );
    expect(unvollstaendig).toContain('ENTWURF');
    expect(unvollstaendig).toContain('Leistungsbeginn fehlt');
  });
});

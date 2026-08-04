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
      await buildContractDocument({ ...BASE_CONTRACT, dsgvoVariante: 'arztpraxis' })
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
    expect(xml).toContain('innerhalb von 14 Tagen zu leisten');
    expect(xml).not.toContain('null Tagen');
  });

  it('zeigt "—" statt erfundener "0,00 EUR" bei fehlender Vergütung (Regressionstest)', async () => {
    // Bug gefunden beim Rechts-Audit 2026-07-30: Number(null) und Number('')
    // sind 0, nicht NaN - eine fehlende Vergütung wurde dadurch als "0,00
    // EUR netto... entspricht 0,00 EUR brutto" ins Dokument geschrieben,
    // ein erfundener, falscher Geldbetrag in einem sonst als vollständig
    // wirkenden Vertrag.
    const xml = await extractDocumentXml(
      await buildContractDocument({ ...BASE_CONTRACT, verguetungNetto: null })
    );
    // Gezielt statt pauschal "0,00 EUR" verboten - §2.3 enthält legitim
    // "50,00 EUR" (Schlüssel-Haftungsgrenze), das sonst fälschlich träfe.
    expect(xml).not.toContain('in Höhe von 0,00 EUR');
    expect(xml).not.toContain('entspricht 0,00 EUR');
    expect(xml).toContain('— netto');
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

  it('rechnet die Vertragsstrafe (§7.5) explizit auf weitergehenden Schadensersatz an (AGB-Fix)', async () => {
    // Gefunden beim Rechts-Audit 2026-07-30: "unbeschadet weitergehender
    // Schadensersatzansprüche" ohne Anrechnung ist ein klassisches
    // AGB-Unwirksamkeitsmuster (Vertragsstrafe + voller Schaden kumuliert
    // statt angerechnet).
    const xml = await extractDocumentXml(await buildContractDocument(BASE_CONTRACT));
    expect(xml).toContain('wird auf einen solchen weitergehenden Schadensersatzanspruch angerechnet');
  });

  it('verlangt von Kunden-Erklärungen nur Textform, nie die strengere Schriftform (§309 Nr. 13 BGB)', async () => {
    // Gefunden beim Rechts-Audit 2026-07-30: mehrere Klauseln verlangten
    // "schriftlich" (echte Schriftform, § 126 BGB) für Erklärungen des
    // Kunden gegenüber dem Verwender - das ist in Verbraucher-AGB nach
    // § 309 Nr. 13 BGB unwirksam. § 9.1 nutzte schon korrekt "Textform".
    // § 7.4 (interne Mitarbeiterverpflichtung, kein Kunden-Verwender-
    // Verhältnis) bleibt bewusst bei "schriftlich" - deshalb hier keine
    // pauschale Prüfung auf "kommt gar nicht mehr vor", sondern gezielt die
    // vorher betroffenen Kundenerklärungen.
    const xml = await extractDocumentXml(await buildContractDocument(BASE_CONTRACT));
    expect(xml).toContain('in Textform einen oder mehrere Mängel rügt'); // §4.1
    expect(xml).toContain('in Textform eine Frist zur'); // §4.3 (Nacherfüllungsfrist)
    expect(xml).toContain('trotz Abmahnung in Textform'); // §6.3
    expect(xml).toContain('nach Mahnung in Textform'); // §6.3
    expect(xml).not.toContain('schriftlich einen oder mehrere Mängel rügt');
    expect(xml).not.toContain('schriftlich eine Frist zur Nacherfüllung');
    expect(xml).not.toContain('trotz schriftlicher Abmahnung');
    expect(xml).not.toContain('nach schriftlicher Mahnung');

    // §6.1 ("...von einer Partei in Textform gekündigt...") erscheint nur
    // bei befristeter Laufzeit (Auto-Verlängerungs-Fall) - eigener Aufruf.
    const befristet = await extractDocumentXml(await buildContractDocument({ ...BASE_CONTRACT, laufzeitMonate: 24 }));
    expect(befristet).toContain('von einer Partei in Textform');
    expect(befristet).not.toContain('von einer Partei schriftlich');
  });

  it('§1.2: Angebot gilt für die Regelleistung, optionale Angebotspositionen sind ohne § 2-Eintrag ausgeschlossen (Rechts-Audit gegen VT-1265)', async () => {
    // Zurückgenommene Annahme vom 2026-07-30: "gilt insbesondere für die
    // Vergütung ..." wurde fälschlich für widersprüchlich zu § 3.1/§ 9.3
    // gehalten und entfernt. Der echte, unterschriebene Referenzvertrag
    // VT-1265 (§ 1.2) zeigt: kein Widerspruch - der Satz bezieht sich auf
    // die im Angebot ursprünglich kalkulierte Regelleistung (identisch zu
    // § 3.1), nicht auf optionale Positionen. Optionale, im Angebot als
    // solche ausgewiesene Positionen sind standardmäßig NICHT
    // Vertragsbestandteil (gesonderte schriftliche Beauftragung nötig) -
    // nur wenn sie tatsächlich in optionalePositionen (§ 2) aufgenommen
    // wurden, gelten sie als eingeschlossen. Gefunden/korrigiert 2026-07-31.
    const ohneOptionale = await extractDocumentXml(
      await buildContractDocument({ ...BASE_CONTRACT, angebotNummer: 'AN-1', angebotDatum: '2026-07-01' })
    );
    expect(ohneOptionale).toContain('gilt insbesondere für die Vergütung der Unterhaltsreinigungsleistungen');
    expect(ohneOptionale).toContain(
      'Die im Angebot als optional ausgewiesenen Positionen sind nicht Gegenstand dieses Vertrages'
    );
    expect(ohneOptionale).not.toContain('Die Vergütung optionaler Zusatzpositionen richtet sich nach § 2');

    const mitOptionalen = await extractDocumentXml(
      await buildContractDocument({
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
});

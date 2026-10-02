import { describe, it, expect } from 'vitest';
import { buildWinterdienstOffer, saisonMonate, satzungsgeber } from './winterdienstOffer.js';
import { pickNextOfferNumber } from '../lib/sevdesk.js';

const BASE = {
  offerNumber: 'AN-1363',
  offerDate: '2026-10-02',
  gueltigBis: '2026-10-23',
  saisonStart: '2026-11-01',
  saisonEnde: '2027-03-31',
  objekt: 'Im Dickten 24, 42281 Wuppertal',
  stadt: 'Wuppertal',
  art: 'weg',
  auftraggeber: 'Gemeinschaft der Wohnungseigentümer Im Dickten 24, 42281 Wuppertal',
  vertreter: { name: 'Hausverwaltung Ulrich Altenbeck e.K.', street: 'Rudolfstr. 8', zipCity: '42285 Wuppertal' },
  preise: { bereitschaft: 80, streuen: 96.51, raeumen: 136.19 },
};

describe('winterdienstOffer', () => {
  it('zählt die Saisonmonate inklusive Start- und Endmonat', () => {
    expect(saisonMonate('2026-11-01', '2027-03-31')).toBe(5);
    expect(saisonMonate('2026-12-01', '2027-02-28')).toBe(3);
    expect(saisonMonate('2027-03-01', '2026-11-01')).toBe(0);
  });

  it('setzt "Stadt" vor den Ort, außer er ist schon benannt', () => {
    expect(satzungsgeber('Köln')).toBe('Stadt Köln');
    expect(satzungsgeber('Gemeinde Odenthal')).toBe('Gemeinde Odenthal');
  });

  it('baut die Positionen wie AN-1363: Bereitschaft × Monate, Einsatzpreise optional', () => {
    const o = buildWinterdienstOffer(BASE);
    expect(o.positions).toHaveLength(3);
    expect(o.positions[0]).toMatchObject({ quantity: 5, price: 80, optional: false });
    expect(o.positions[0].text).toBe('Saison Nov. 2026 bis März 2027 (5 Monate)');
    expect(o.positions[1]).toMatchObject({ price: 96.51, optional: true });
    expect(o.positions[2]).toMatchObject({ price: 136.19, optional: true });
    expect(o.summeNetto).toBe(400);
  });

  it('trennt die Abschnitte per Seitenumbruch und lässt nur den Kunden unterschreiben', () => {
    const o = buildWinterdienstOffer(BASE);
    expect(o.footText.match(/page-break-before/g)).toHaveLength(4);
    expect(o.footText).toContain('Unterschrift und Stempel Auftraggeber');
    expect(o.footText).toContain('ohne Unterschrift gültig');
    expect(o.footText.match(/<br><b>Unterschrift/g)).toHaveLength(1);
    expect(o.footText).not.toContain('Unterschrift Dienstleister');
    expect(o.footText).toContain('Angebots AN-1363 vom 02.10.2026');
    expect(o.footText).toContain('Straßenreinigungssatzung der Stadt Wuppertal');
    expect(o.footText).toContain('mindestens 1.000.000 €');
    expect(o.footText).toContain('vertreten durch Hausverwaltung Ulrich Altenbeck e.K., Rudolfstr. 8, 42285 Wuppertal');
    expect(o.headText).toContain('bis zum <b>23.10.2026</b>');
  });

  it('enthält keine automatische Verlängerung und keine 24-Stunden-Pflicht', () => {
    const { footText, headText } = buildWinterdienstOffer(BASE);
    const all = headText + footText;
    expect(all).not.toMatch(/verlängert sich/);
    expect(all).not.toMatch(/unabhängig von der Tageszeit/);
    expect(all).toContain('07:00 bis 20:00 Uhr');
  });

  it('lässt die Widerrufsbelehrung bei Firmenkunden weg', () => {
    const o = buildWinterdienstOffer({ ...BASE, art: 'firma', auftraggeber: 'Muster GmbH', vertreter: null });
    expect(o.footText).not.toContain('Widerrufsbelehrung');
    expect(o.footText).not.toContain('Nur bei Widerrufsrecht');
    expect(o.footText.match(/page-break-before/g)).toHaveLength(3);
    const weg = buildWinterdienstOffer(BASE);
    expect(weg.footText).toContain('Muster-Widerrufsformular');
  });

  it('baut die Anschrift mit Vertreter, sonst mit Rechnungsanschrift', () => {
    expect(buildWinterdienstOffer(BASE).address).toBe(
      'Gemeinschaft der Wohnungseigentümer Im Dickten 24, 42281 Wuppertal\nvertreten durch Hausverwaltung Ulrich Altenbeck e.K.\nRudolfstr. 8\n42285 Wuppertal'
    );
    const ohne = buildWinterdienstOffer({
      ...BASE,
      art: 'firma',
      auftraggeber: 'Muster GmbH',
      vertreter: null,
      rechnungsanschrift: { street: 'Hauptstr. 1', zipCity: '50667 Köln' },
    });
    expect(ohne.address).toBe('Muster GmbH\nHauptstr. 1\n50667 Köln');
    expect(ohne.addressName).toBe('Muster GmbH');
  });

  it('escaped Freitext, damit kein HTML in sevDesk landet', () => {
    const o = buildWinterdienstOffer({ ...BASE, flaeche: 'Hof <b>& Zufahrt</b>' });
    expect(o.footText).toContain('Hof &lt;b&gt;&amp; Zufahrt&lt;/b&gt;');
  });
});

describe('pickNextOfferNumber', () => {
  it('nimmt die höchste vergebene Nummer + 1, wenn der sevDesk-Zähler hinterherhinkt', () => {
    expect(pickNextOfferNumber('AN-1363', ['AN-1364', 'AN-1363', 'AN-1362'])).toBe('AN-1365');
  });
  it('nimmt den Zähler, wenn er vorne liegt', () => {
    expect(pickNextOfferNumber('AN-1400', ['AN-1364'])).toBe('AN-1400');
  });
  it('ignoriert fremde Nummernformate und fällt sonst auf den Zähler zurück', () => {
    expect(pickNextOfferNumber('AN-1363', ['XY-9999', null])).toBe('AN-1363');
    expect(pickNextOfferNumber(null, [])).toBe(null);
  });
});

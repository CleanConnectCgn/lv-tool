import { describe, it, expect } from 'vitest';
import { validateContract } from './contractRules.js';

describe('validateContract', () => {
  it('meldet keine errors/warnings bei vollständigen, gültigen Daten', () => {
    const { errors, warnings } = validateContract({
      kunde: { firma: 'Muster GmbH' },
      objektAdresse: 'Musterstraße 1, 50667 Köln',
      dsgvoVariante: 'standard',
      kuendigungsfristMonate: 2,
      mwstSatz: 19,
      laufzeitMonate: 12,
      vertragsbeginn: '2026-09-01',
      verguetungNetto: 500,
      reinigungsintervall: '2x wöchentlich',
      internerAnsprechpartner: 'Julian Mühlhoff',
    });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('blockiert unbekannte Datenschutz-Klausel', () => {
    const { errors } = validateContract({ dsgvoVariante: 'nicht-vorhanden' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('blockiert Kündigungsfrist <= 0', () => {
    const { errors } = validateContract({ kuendigungsfristMonate: 0 });
    expect(errors.some((e) => e.includes('Kündigungsfrist'))).toBe(true);
  });

  it('blockiert MwSt.-Satz außerhalb 0-25', () => {
    expect(validateContract({ mwstSatz: 30 }).errors.some((e) => e.includes('MwSt'))).toBe(true);
    expect(validateContract({ mwstSatz: -1 }).errors.some((e) => e.includes('MwSt'))).toBe(true);
  });

  it('blockiert negative Laufzeit', () => {
    const { errors } = validateContract({ laufzeitMonate: -3 });
    expect(errors.some((e) => e.includes('Laufzeit'))).toBe(true);
  });

  it('warnt (blockiert nicht) bei fehlenden fachlichen Feldern', () => {
    const { errors, warnings } = validateContract({});
    expect(errors).toEqual([]);
    expect(warnings.length).toBeGreaterThanOrEqual(6);
    expect(warnings.some((w) => w.includes('Kundenname'))).toBe(true);
    expect(warnings.some((w) => w.includes('Objektadresse'))).toBe(true);
    expect(warnings.some((w) => w.includes('Leistungsbeginn'))).toBe(true);
    expect(warnings.some((w) => w.includes('Vergütung'))).toBe(true);
    expect(warnings.some((w) => w.includes('Reinigungsintervall'))).toBe(true);
    expect(warnings.some((w) => w.includes('Ansprechpartner'))).toBe(true);
  });

  it('warnt bei Branche/Klausel-Mismatch (z.B. Standard-Klausel für Arztpraxis)', () => {
    const { warnings } = validateContract({ branche: 'praxis', dsgvoVariante: 'standard' });
    expect(warnings.some((w) => w.includes('praxis'))).toBe(true);
  });

  it('warnt nicht, wenn Branche und Klausel zusammenpassen', () => {
    const { warnings } = validateContract({
      kunde: { firma: 'Praxis Muster' },
      objektAdresse: 'Praxisweg 1, 50667 Köln',
      branche: 'praxis',
      dsgvoVariante: 'gesundheitsdaten',
      vertragsbeginn: '2026-09-01',
      verguetungNetto: 500,
      reinigungsintervall: '2x wöchentlich',
      internerAnsprechpartner: 'X',
    });
    expect(warnings).toEqual([]);
  });
});

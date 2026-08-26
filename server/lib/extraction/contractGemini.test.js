import { describe, it, expect } from 'vitest';
import { sanitizeDraft } from './contractGemini.js';

describe('sanitizeDraft (reine Logik, kein I/O)', () => {
  it('übernimmt gültige Werte unverändert', () => {
    const draft = sanitizeDraft({
      erkannteKundenfirma: 'Musterfirma GmbH',
      branche: 'buero',
      leistungsart: 'Unterhaltsreinigung',
      verguetungNetto: 450.5,
      vertragsbeginn: '2026-09-01',
      dsgvoVariante: 'standard',
    });
    expect(draft.erkannteKundenfirma).toBe('Musterfirma GmbH');
    expect(draft.branche).toBe('buero');
    expect(draft.verguetungNetto).toBe(450.5);
    expect(draft.dsgvoVariante).toBe('standard');
  });

  it('setzt eine vom Modell erfundene branche auf "sonstiges" statt sie zu übernehmen', () => {
    const draft = sanitizeDraft({ branche: 'gibt-es-nicht' });
    expect(draft.branche).toBe('sonstiges');
  });

  it('setzt eine vom Modell erfundene dsgvoVariante auf "standard" statt sie zu übernehmen', () => {
    const draft = sanitizeDraft({ dsgvoVariante: 'gibt-es-nicht' });
    expect(draft.dsgvoVariante).toBe('standard');
  });

  it('wandelt Nicht-Zahlen für numerische Felder in null statt sie roh durchzureichen', () => {
    const draft = sanitizeDraft({ verguetungNetto: 'vierhundertfünfzig', kuendigungsfristMonate: null });
    expect(draft.verguetungNetto).toBeNull();
    expect(draft.kuendigungsfristMonate).toBeNull();
  });

  it('kommt auch mit einem leeren/fehlenden Objekt klar (keine Exception)', () => {
    const draft = sanitizeDraft(undefined);
    expect(draft.branche).toBe('sonstiges');
    expect(draft.dsgvoVariante).toBe('standard');
    expect(draft.erkannteKundenfirma).toBe('');
  });
});

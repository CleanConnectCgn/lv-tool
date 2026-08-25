import { describe, it, expect } from 'vitest';
import { geminiErrorMessage } from './geminiError.js';

describe('geminiErrorMessage (reine Übersetzungslogik, kein I/O)', () => {
  it('übersetzt 429/Quota-Meldungen in eine handlungsorientierte Meldung', () => {
    expect(geminiErrorMessage(new Error('429 Too Many Requests'))).toContain('Kontingent');
    expect(geminiErrorMessage({ message: 'You exceeded your current quota' })).toContain('Kontingent');
  });

  it('übersetzt ungültige API-Keys (401/invalid key)', () => {
    expect(geminiErrorMessage({ status: 401, message: 'Request had invalid authentication credentials.' })).toContain(
      'GEMINI_API_KEY'
    );
  });

  it('übersetzt unlesbare Bild-/PDF-Eingaben (400)', () => {
    expect(geminiErrorMessage({ status: 400, message: 'Request contains an invalid argument.' })).toContain(
      'ungültiges Bild/PDF-Format'
    );
  });

  it('übersetzt unbekannte Modellnamen (404)', () => {
    expect(geminiErrorMessage({ status: 404, message: 'models/gemini-falsch not found' })).toContain('Modell');
  });

  it('lässt unbekannte Meldungen unverändert durch (z.B. Timeout)', () => {
    const raw = 'Gemini hat nicht innerhalb von 90s geantwortet';
    expect(geminiErrorMessage(new Error(raw))).toBe(raw);
  });
});

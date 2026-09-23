import { describe, it, expect, vi } from 'vitest';
import { geminiMitRetry, istVoruebergehend } from './geminiCall.js';

function fehlerMit(status, message = 'Fehler') {
  const err = new Error(message);
  err.status = status;
  return err;
}

describe('istVoruebergehend', () => {
  it('erkennt die Überlastungsmeldung, die real auftrat', () => {
    // Wortlaut aus dem Fehler vom 23.09.2026 im Besichtigungs-Diktat.
    const err = new Error(
      '[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent: [503 Service Unavailable] This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.'
    );
    expect(istVoruebergehend(err)).toBe(true);
  });

  it('erkennt Serverfehler über den Status', () => {
    [500, 502, 503, 504].forEach((s) => expect(istVoruebergehend(fehlerMit(s))).toBe(true));
  });

  it('erkennt abgebrochene Verbindungen', () => {
    expect(istVoruebergehend(new Error('fetch failed'))).toBe(true);
    expect(istVoruebergehend(new Error('socket hang up'))).toBe(true);
  });

  it('behandelt dauerhafte Fehler NICHT als vorübergehend', () => {
    expect(istVoruebergehend(fehlerMit(401, 'API key not valid'))).toBe(false);
    expect(istVoruebergehend(fehlerMit(400, 'invalid image'))).toBe(false);
    expect(istVoruebergehend(fehlerMit(429, 'quota exceeded'))).toBe(false);
    expect(istVoruebergehend(fehlerMit(404, 'model not found'))).toBe(false);
  });
});

describe('geminiMitRetry', () => {
  it('gibt das Ergebnis beim ersten Erfolg zurück, ohne zu wiederholen', async () => {
    const aufruf = vi.fn().mockResolvedValue('fertig');
    await expect(geminiMitRetry(aufruf)).resolves.toBe('fertig');
    expect(aufruf).toHaveBeenCalledTimes(1);
  });

  it('wiederholt nach einer 503 und liefert dann das Ergebnis', async () => {
    const aufruf = vi
      .fn()
      .mockRejectedValueOnce(fehlerMit(503, 'This model is currently experiencing high demand'))
      .mockResolvedValue('beim zweiten Mal');
    await expect(geminiMitRetry(aufruf, { pauseMs: 1 })).resolves.toBe('beim zweiten Mal');
    expect(aufruf).toHaveBeenCalledTimes(2);
  });

  it('gibt nach allen Versuchen den letzten Fehler weiter', async () => {
    const aufruf = vi.fn().mockRejectedValue(fehlerMit(503, 'high demand'));
    await expect(geminiMitRetry(aufruf, { versuche: 3, pauseMs: 1 })).rejects.toThrow('high demand');
    expect(aufruf).toHaveBeenCalledTimes(3);
  });

  it('wiederholt einen dauerhaften Fehler nicht', async () => {
    const aufruf = vi.fn().mockRejectedValue(fehlerMit(401, 'API key not valid'));
    await expect(geminiMitRetry(aufruf, { pauseMs: 1 })).rejects.toThrow('API key not valid');
    expect(aufruf).toHaveBeenCalledTimes(1);
  });

  it('bricht einen hängenden Aufruf nach dem Zeitlimit ab', async () => {
    const aufruf = vi.fn(() => new Promise(() => {}));
    await expect(
      geminiMitRetry(aufruf, { timeoutMs: 20, versuche: 1, label: 'Gemini' })
    ).rejects.toThrow(/nicht innerhalb/);
  });

  it('wiederholt einen Zeitüberschreitung-Abbruch bewusst NICHT', async () => {
    // Bei 90s Zeitlimit und drei Versuchen würde der Nutzer sonst bis zu
    // viereinhalb Minuten vor einem drehenden Rad sitzen. Ein Timeout wird
    // deshalb sofort gemeldet - der zweite Versuch ist dann ein Klick,
    // keine stille Wartezeit.
    const aufruf = vi.fn(() => new Promise(() => {}));
    await expect(
      geminiMitRetry(aufruf, { timeoutMs: 20, versuche: 3, pauseMs: 1 })
    ).rejects.toThrow(/nicht innerhalb/);
    expect(aufruf).toHaveBeenCalledTimes(1);
  });
});

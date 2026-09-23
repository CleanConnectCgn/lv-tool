import { describe, it, expect, vi } from 'vitest';
import { geminiMitRetry, istVoruebergehend, istModellProblem } from './geminiCall.js';

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
    await expect(geminiMitRetry(aufruf, { modelle: ['m1'] })).resolves.toBe('fertig');
    expect(aufruf).toHaveBeenCalledTimes(1);
  });

  it('wiederholt nach einer 503 und liefert dann das Ergebnis', async () => {
    const aufruf = vi
      .fn()
      .mockRejectedValueOnce(fehlerMit(503, 'This model is currently experiencing high demand'))
      .mockResolvedValue('beim zweiten Mal');
    await expect(geminiMitRetry(aufruf, { pauseMs: 1, modelle: ['m1'] })).resolves.toBe('beim zweiten Mal');
    expect(aufruf).toHaveBeenCalledTimes(2);
  });

  it('gibt nach allen Versuchen den letzten Fehler weiter', async () => {
    const aufruf = vi.fn().mockRejectedValue(fehlerMit(503, 'high demand'));
    await expect(geminiMitRetry(aufruf, { versuchePorModell: 3, pauseMs: 1, modelle: ['m1'] })).rejects.toThrow('high demand');
    expect(aufruf).toHaveBeenCalledTimes(3);
  });

  it('wiederholt einen dauerhaften Fehler nicht', async () => {
    const aufruf = vi.fn().mockRejectedValue(fehlerMit(401, 'API key not valid'));
    await expect(geminiMitRetry(aufruf, { pauseMs: 1, modelle: ['m1'] })).rejects.toThrow('API key not valid');
    expect(aufruf).toHaveBeenCalledTimes(1);
  });

  it('bricht einen hängenden Aufruf nach dem Zeitlimit ab', async () => {
    const aufruf = vi.fn(() => new Promise(() => {}));
    await expect(
      geminiMitRetry(aufruf, { timeoutMs: 20, modelle: ['m1'], label: 'Gemini' })
    ).rejects.toThrow(/nicht innerhalb/);
  });

  it('wiederholt einen Zeitüberschreitung-Abbruch bewusst NICHT', async () => {
    // Bei 90s Zeitlimit und drei Versuchen würde der Nutzer sonst bis zu
    // viereinhalb Minuten vor einem drehenden Rad sitzen. Ein Timeout wird
    // deshalb sofort gemeldet - der zweite Versuch ist dann ein Klick,
    // keine stille Wartezeit.
    const aufruf = vi.fn(() => new Promise(() => {}));
    await expect(
      geminiMitRetry(aufruf, { timeoutMs: 20, pauseMs: 1, modelle: ['m1', 'm2'] })
    ).rejects.toThrow(/nicht innerhalb/);
    expect(aufruf).toHaveBeenCalledTimes(1);
  });
});

describe('Modellwechsel', () => {
  it('weicht auf das nächste Modell aus, wenn das erste überlastet bleibt', async () => {
    // Genau der Fall vom 23.09.2026: gemini-flash-latest lieferte stundenlang
    // 503, gemini-3.6-flash antwortete sofort.
    const benutzt = [];
    const aufruf = vi.fn(async (modell) => {
      benutzt.push(modell);
      if (modell === 'überlastet') throw fehlerMit(503, 'high demand');
      return 'geht';
    });
    await expect(
      geminiMitRetry(aufruf, { modelle: ['überlastet', 'frei'], versuchePorModell: 2, pauseMs: 1 })
    ).resolves.toBe('geht');
    // zweimal das erste, dann das zweite
    expect(benutzt).toEqual(['überlastet', 'überlastet', 'frei']);
  });

  it('springt bei einem abgekündigten Modell sofort weiter, ohne zweiten Versuch', async () => {
    const benutzt = [];
    const aufruf = vi.fn(async (modell) => {
      benutzt.push(modell);
      if (modell === 'weg') throw fehlerMit(404, 'This model is no longer available to new users');
      return 'geht';
    });
    await expect(
      geminiMitRetry(aufruf, { modelle: ['weg', 'aktuell'], versuchePorModell: 3, pauseMs: 1 })
    ).resolves.toBe('geht');
    expect(benutzt).toEqual(['weg', 'aktuell']);
  });

  it('meldet den letzten Fehler, wenn alle Modelle überlastet sind', async () => {
    const aufruf = vi.fn().mockRejectedValue(fehlerMit(503, 'high demand'));
    await expect(
      geminiMitRetry(aufruf, { modelle: ['a', 'b'], versuchePorModell: 2, pauseMs: 1 })
    ).rejects.toThrow('high demand');
    expect(aufruf).toHaveBeenCalledTimes(4);
  });

  it('wechselt bei einem dauerhaften Fehler NICHT das Modell', async () => {
    // Ein ungültiger Key wird beim nächsten Modell genauso ungültig sein.
    const aufruf = vi.fn().mockRejectedValue(fehlerMit(401, 'API key not valid'));
    await expect(
      geminiMitRetry(aufruf, { modelle: ['a', 'b'], pauseMs: 1 })
    ).rejects.toThrow('API key not valid');
    expect(aufruf).toHaveBeenCalledTimes(1);
  });
});

describe('istModellProblem', () => {
  it('erkennt ein abgekündigtes Modell', () => {
    expect(istModellProblem(new Error('This model models/gemini-2.5-flash is no longer available to new users'))).toBe(true);
    expect(istModellProblem(fehlerMit(404))).toBe(true);
  });

  it('hält eine Überlastung nicht für ein Modellproblem', () => {
    expect(istModellProblem(fehlerMit(503, 'high demand'))).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { guessSingleService } from './einzelleistungHeuristik.js';

describe('guessSingleService', () => {
  it('erkennt Glasreinigung am Wort "Glas"', () => {
    expect(guessSingleService('Nur die Glasflächen im Erdgeschoss')).toEqual({
      serviceKey: 'glasreinigung',
      customTitle: '',
      erkannt: true,
    });
  });

  it('erkennt Glasreinigung auch über "Fenster" oder "Scheibe"', () => {
    expect(guessSingleService('Einmal alle Fenster putzen').serviceKey).toBe('glasreinigung');
    expect(guessSingleService('Die Scheiben sind sehr verschmutzt').serviceKey).toBe('glasreinigung');
  });

  it('erkennt Grundreinigung', () => {
    expect(guessSingleService('Bitte eine Grundreinigung der Böden')).toEqual({
      serviceKey: 'grundreinigung',
      customTitle: '',
      erkannt: true,
    });
  });

  it('erkennt eine bekannte sonstige Leistung und übernimmt sie als Titel', () => {
    expect(guessSingleService('Wir brauchen eine Teppichreinigung im Flur')).toEqual({
      serviceKey: 'sonstiges',
      customTitle: 'Teppichreinigung',
      erkannt: true,
    });
  });

  it('erkennt Bauendreinigung unabhängig von Groß-/Kleinschreibung', () => {
    expect(guessSingleService('einmalige BAUENDREINIGUNG nach Umbau').customTitle).toBe('Bauendreinigung');
  });

  it('gibt bei unbekannter Leistung "sonstiges" ohne Titel zurück und meldet das ehrlich', () => {
    expect(guessSingleService('Wir brauchen etwas ganz Spezielles für die Lagerhalle')).toEqual({
      serviceKey: 'sonstiges',
      customTitle: '',
      erkannt: false,
    });
  });

  it('bevorzugt Glas- und Grundreinigung vor einer sonstigen Leistung im selben Text', () => {
    // "Glas" kommt vor den anderen Stichworten geprüft - eindeutiger Fall.
    expect(guessSingleService('Glasreinigung und danach Teppichreinigung').serviceKey).toBe('glasreinigung');
  });

  it('kommt mit leerem oder fehlendem Text klar', () => {
    expect(guessSingleService('')).toEqual({ serviceKey: 'sonstiges', customTitle: '', erkannt: false });
    expect(guessSingleService(undefined)).toEqual({ serviceKey: 'sonstiges', customTitle: '', erkannt: false });
    expect(guessSingleService(null)).toEqual({ serviceKey: 'sonstiges', customTitle: '', erkannt: false });
  });
});

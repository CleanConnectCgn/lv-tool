import { describe, it, expect } from 'vitest';
import { breakLongWords } from './lvPdfExport.js';

describe('breakLongWords', () => {
  it('bricht ein überlanges zusammengesetztes Wort an seinem eigenen Trennzeichen um', () => {
    // Im ausgelieferten PDF (Rhöndorfer Str. 8, 22.09.2026) stand wörtlich
    // "Sper rmüll-/Entrümpelungsraum": autoTable hatte mitten im Wort und
    // ohne Trennstrich umbrochen.
    const out = breakLongWords('Sperrmüll-/Entrümpelungsraums');
    expect(out).toContain('\n');
    // Der Umbruch liegt hinter einem Trennzeichen, nicht mitten im Wort.
    out.split('\n').forEach((part, i, all) => {
      if (i < all.length - 1) expect(part.endsWith('-') || part.endsWith('/')).toBe(true);
    });
    // Und der Text bleibt inhaltlich unverändert.
    expect(out.replace(/\n/g, '')).toBe('Sperrmüll-/Entrümpelungsraums');
  });

  it('lässt normale Wörter und Sätze unangetastet', () => {
    const text = 'Feuchte Reinigung der Türblätter und Türklinken.';
    expect(breakLongWords(text)).toBe(text);
  });

  it('lässt ein langes Wort ohne Trennzeichen unverändert, statt es zu zerhacken', () => {
    const wort = 'Donaudampfschifffahrtsgesellschaftskapitaen';
    expect(breakLongWords(wort)).toBe(wort);
  });

  it('erhält Leerzeichen und Umbrüche des Originaltexts', () => {
    const text = 'Erste Zeile\nZweite Zeile';
    expect(breakLongWords(text)).toBe(text);
  });

  it('kommt mit leerem oder fehlendem Text klar', () => {
    expect(breakLongWords('')).toBe('');
    expect(breakLongWords(undefined)).toBe('');
    expect(breakLongWords(null)).toBe('');
  });
});

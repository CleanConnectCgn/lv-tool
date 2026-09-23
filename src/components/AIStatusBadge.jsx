import React from 'react';

// Zeigt dauerhaft an, ob am Leistungsverzeichnis etwas nicht stimmt.
//
// Die Anzeige hängt seit 2026-09-23 an den festen Regeln, nicht mehr am
// KI-Ergebnis: Die Regeln laufen bei jeder Änderung sofort mit, also kann
// das Ergebnis immer sichtbar sein, statt erst nach einem Aufruf zu
// erscheinen und danach zu veralten.
export default function AIStatusBadge({ regelBefunde = [], kiStatus = 'idle', onClick }) {
  const fehler = regelBefunde.filter((b) => b.type === 'red').length;
  const hinweise = regelBefunde.length - fehler;

  let label;
  let className = 'ai-status-badge';

  if (fehler > 0) {
    label = `${fehler} ${fehler === 1 ? 'Fehler' : 'Fehler'}${hinweise > 0 ? `, ${hinweise} Hinweise` : ''}`;
    className += ' issues-red';
  } else if (hinweise > 0) {
    label = `${hinweise} ${hinweise === 1 ? 'Hinweis' : 'Hinweise'}`;
    className += ' issues-orange';
  } else {
    label = 'LV geprüft ✓';
    className += ' clean';
  }

  return (
    <button type="button" className={className} onClick={onClick} title="Prüfung öffnen">
      {kiStatus === 'pending' && <span className="ai-status-spinner" />}
      {label}
    </button>
  );
}

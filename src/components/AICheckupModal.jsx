import React, { useMemo, useState } from 'react';

// Prüfung des Leistungsverzeichnisses.
//
// Bis 2026-09-23 liefen hier drei Prüfungen nebeneinander (ein Schnellcheck
// plus ein "Dual-Checkup", bei dem Claude Geminis Ergebnis bewertete). Für
// ein Dokument dieser Größe war das überdimensioniert und teuer, und die
// beiden Modelle widersprachen sich regelmäßig, ohne dass daraus etwas
// folgte.
//
// Jetzt gibt es zwei klar getrennte Quellen:
//   Prüfung  - feste Regeln, laufen im Browser bei jeder Änderung mit,
//              sofort und ohne Kosten. Alles, was eindeutig entscheidbar ist.
//   Ergänzung - ein einziger Gemini-Aufruf für Ermessensfragen (fehlende
//              branchenübliche Leistung, unklare Formulierung).

const FIX_FELD = {
  replace_row: 'text',
  replace_beschreibung: 'beschreibung',
  replace_bemerkung: 'bemerkung',
};

export default function AICheckupModal({
  status,
  regelBefunde = [],
  issues = [],
  error,
  setSections,
  onClose,
  onRecheck,
}) {
  const [angewendet, setAngewendet] = useState({});
  const [verlauf, setVerlauf] = useState([]);

  // Findet die gemeinte Zeile über ihren Text, mit dem Index nur als
  // Rückfallebene. Sonst greift der zweite angewandte Befund daneben,
  // sobald der erste eine Zeile entfernt hat.
  function findeZeile(rows, befund) {
    if (befund.zeilenText) {
      const i = rows.findIndex((r) => (r.text || '').trim() === befund.zeilenText.trim());
      if (i >= 0) return i;
    }
    return typeof befund.targetRowIndex === 'number' ? befund.targetRowIndex : -1;
  }

  function anwenden(befund) {
    const feld = FIX_FELD[befund.fixType];
    if (!feld && befund.fixType !== 'remove_row') return;

    setSections((prev) => {
      setVerlauf((h) => [...h, { snapshot: prev, id: befund.id }]);
      return prev.map((s) => {
        if (befund.targetSection && s.title !== befund.targetSection) return s;
        const rows = s.rows || [];
        const index = findeZeile(rows, befund);
        if (index < 0 || index >= rows.length) return s;

        if (befund.fixType === 'remove_row') {
          return { ...s, rows: rows.filter((_, i) => i !== index) };
        }
        return {
          ...s,
          rows: rows.map((r, i) => (i === index ? { ...r, [feld]: befund.fix } : r)),
        };
      });
    });
    setAngewendet((prev) => ({ ...prev, [befund.id]: true }));
  }

  function alleAnwenden(liste) {
    liste.filter((b) => !angewendet[b.id] && istAnwendbar(b)).forEach(anwenden);
  }

  function rueckgaengig() {
    setVerlauf((h) => {
      if (h.length === 0) return h;
      const letzter = h[h.length - 1];
      setSections(letzter.snapshot);
      setAngewendet((prev) => {
        const next = { ...prev };
        delete next[letzter.id];
        return next;
      });
      return h.slice(0, -1);
    });
  }

  function istAnwendbar(b) {
    return b.fixType === 'remove_row' || (!!b.fix && !!FIX_FELD[b.fixType]);
  }

  const rot = useMemo(() => regelBefunde.filter((b) => b.type === 'red'), [regelBefunde]);
  const orange = useMemo(() => regelBefunde.filter((b) => b.type !== 'red'), [regelBefunde]);
  const anwendbarRot = rot.filter(istAnwendbar).length;

  function Befund({ befund }) {
    const fertig = angewendet[befund.id];
    return (
      <div className={`ai-issue-card ai-issue-${befund.type}${fertig ? ' applied' : ''}`}>
        <div className="ai-issue-header">
          <span className="ai-issue-icon">{befund.type === 'red' ? '🔴' : '🟠'}</span>
          <span className="ai-issue-title">{befund.title}</span>
          {befund.targetSection && <span className="ai-issue-ort">{befund.targetSection}</span>}
        </div>
        <p className="ai-issue-desc">{befund.description}</p>
        {befund.fix && FIX_FELD[befund.fixType] && !fertig && (
          <p className="ai-issue-fix">Neu: „{befund.fix}"</p>
        )}
        {fertig ? (
          <span className="ai-issue-applied-label">✓ Übernommen</span>
        ) : (
          istAnwendbar(befund) && (
            <div className="ai-issue-actions">
              <button
                className={befund.fixType === 'remove_row' ? 'ai-btn-remove' : 'ai-btn-apply'}
                onClick={() => anwenden(befund)}
              >
                {befund.fixType === 'remove_row' ? 'Zeile entfernen' : 'Übernehmen'}
              </button>
            </div>
          )
        )}
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal ai-checkup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-modal-header">
          <h2>Prüfung</h2>
          <div className="ai-modal-header-actions">
            {verlauf.length > 0 && (
              <button type="button" className="ai-undo-btn" onClick={rueckgaengig}>
                ↺ Rückgängig ({verlauf.length})
              </button>
            )}
          </div>
        </div>

        {/* --- Feste Regeln: immer da, ohne Warten --- */}
        {regelBefunde.length === 0 ? (
          <div className="modal-message success">✓ Keine formalen Fehler gefunden</div>
        ) : (
          <>
            <div className="ai-abschnitt-kopf">
              <span>
                {rot.length} Fehler, {orange.length} Hinweise
              </span>
              {anwendbarRot > 1 && (
                <button className="ai-btn-apply" onClick={() => alleAnwenden(rot)}>
                  Alle {anwendbarRot} Korrekturen übernehmen
                </button>
              )}
            </div>
            {rot.map((b) => (
              <Befund key={b.id} befund={b} />
            ))}
            {orange.map((b) => (
              <Befund key={b.id} befund={b} />
            ))}
          </>
        )}

        {/* --- Fachliche Ergänzung: ein KI-Aufruf --- */}
        <div className="ai-ergaenzung">
          <div className="ai-abschnitt-kopf">
            <span className="ai-abschnitt-titel">Fachliche Ergänzung</span>
            <button
              type="button"
              className="ai-btn-apply"
              onClick={onRecheck}
              disabled={status === 'pending'}
            >
              {status === 'pending' ? 'Prüft…' : status === 'done' ? 'Erneut prüfen' : 'Prüfen'}
            </button>
          </div>
          <p className="modal-hint">
            Sucht nach Leistungen, die in einem Objekt dieser Art üblicherweise dazugehören, und nach
            Formulierungen, die beim Kunden Rückfragen auslösen könnten.
          </p>

          {status === 'pending' && (
            <div className="ai-loading">
              <div className="ai-spinner" />
              <p>Wird geprüft…</p>
            </div>
          )}
          {status === 'error' && <div className="modal-message error">{error}</div>}
          {status === 'stale' && (
            <div className="modal-message">Das LV wurde seit der letzten Prüfung geändert.</div>
          )}
          {status === 'done' && issues.length === 0 && (
            <div className="modal-message success">✓ Fachlich nichts zu beanstanden</div>
          )}
          {issues.map((b, i) => (
            <Befund key={b.id || `ki-${i}`} befund={b} />
          ))}
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  );
}

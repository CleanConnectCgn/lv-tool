import React, { useState } from 'react';

export default function AICheckupModal({
  status,
  issues,
  error,
  setSections,
  onClose,
  onRecheck,
  geminiStatus = 'idle',
  geminiResult,
  geminiError,
  claudeStatus = 'idle',
  claudeResult,
  claudeError,
  onRunDualCheckup,
}) {
  const [appliedIds, setAppliedIds] = useState({});

  function applyFix(issue) {
    if (!issue.fix && issue.fixType !== 'remove_row') return;
    setSections((prev) =>
      prev.map((s) => {
        if (issue.targetSection && s.title !== issue.targetSection) return s;
        if (issue.fixType === 'rename_section') {
          return issue.targetSection && s.title === issue.targetSection ? { ...s, title: issue.fix } : s;
        }
        if (issue.targetRowIndex == null) return s;
        if (issue.fixType === 'remove_row') {
          return { ...s, rows: s.rows.filter((_, idx) => idx !== issue.targetRowIndex) };
        }
        if (issue.fixType === 'replace_row') {
          return {
            ...s,
            rows: s.rows.map((r, idx) => (idx === issue.targetRowIndex ? { ...r, text: issue.fix } : r)),
          };
        }
        return s;
      })
    );
    setAppliedIds((prev) => ({ ...prev, [issue.id]: true }));
  }

  function applyAll(type) {
    issues
      .filter((i) => i.type === type && !appliedIds[i.id] && (i.fix || i.fixType === 'remove_row'))
      .forEach((i) => applyFix(i));
  }

  const redIssues = issues.filter((i) => i.type === 'red');
  const orangeIssues = issues.filter((i) => i.type === 'orange');

  function IssueCard({ issue }) {
    const applied = appliedIds[issue.id];
    return (
      <div className={`ai-issue-card ai-issue-${issue.type}${applied ? ' applied' : ''}`}>
        <div className="ai-issue-header">
          <span className="ai-issue-icon">{issue.type === 'red' ? '🔴' : '🟠'}</span>
          <span className="ai-issue-title">{issue.title}</span>
        </div>
        <p className="ai-issue-desc">{issue.description}</p>
        {applied ? (
          <span className="ai-issue-applied-label">✓ Übernommen</span>
        ) : (
          <div className="ai-issue-actions">
            {issue.fix && issue.fixType !== 'remove_row' && (
              <button className="ai-btn-apply" onClick={() => applyFix(issue)}>
                Übernehmen
              </button>
            )}
            {issue.fixType === 'remove_row' && (
              <button className="ai-btn-remove" onClick={() => applyFix(issue)}>
                Entfernen
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal ai-checkup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-modal-header">
          <h2>KI Qualitätsprüfung</h2>
          <button type="button" className="ai-recheck-btn" onClick={onRecheck} disabled={status === 'pending'}>
            {status === 'pending' ? 'Prüft...' : 'Neu prüfen'}
          </button>
        </div>

        {status === 'pending' && (
          <div className="ai-loading">
            <div className="ai-spinner" />
            <p>KI analysiert Ihr Leistungsverzeichnis...</p>
          </div>
        )}

        {status === 'error' && <div className="modal-message error">{error}</div>}

        {status === 'done' && issues.length === 0 && (
          <div className="modal-message success">✓ Ihr LV ist fehlerfrei</div>
        )}

        {status === 'done' && issues.length > 0 && (
          <>
            <div className="ai-bulk-actions">
              {redIssues.length > 0 && (
                <button className="ai-btn-remove" onClick={() => applyAll('red')}>
                  Alle roten übernehmen
                </button>
              )}
              {orangeIssues.length > 0 && (
                <button className="ai-btn-apply" onClick={() => applyAll('orange')}>
                  Alle orangenen übernehmen
                </button>
              )}
            </div>
            {redIssues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
            {orangeIssues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </>
        )}

        <div className="ai-dual-checkup">
          <div className="ai-dual-header">
            <h3>Vollständiger Checkup (Gemini + Claude)</h3>
            <button
              type="button"
              className="ai-btn-apply"
              onClick={onRunDualCheckup}
              disabled={geminiStatus === 'running' || claudeStatus === 'running'}
            >
              {geminiStatus === 'idle' ? 'Checkup starten' : 'Erneut prüfen'}
            </button>
          </div>

          {geminiStatus !== 'idle' && (
            <div className="ai-dual-status-row">
              <span className={`ai-dual-status ai-dual-status-${geminiStatus}`}>
                Gemini{' '}
                {geminiStatus === 'running' && 'läuft...'}
                {geminiStatus === 'done' && '✓ fertig'}
                {geminiStatus === 'error' && '✗ Fehler'}
              </span>
              <span className={`ai-dual-status ai-dual-status-${claudeStatus}`}>
                Claude{' '}
                {claudeStatus === 'idle' && 'wartet'}
                {claudeStatus === 'running' && 'läuft...'}
                {claudeStatus === 'done' && '✓ fertig'}
                {claudeStatus === 'error' && '✗ Fehler'}
              </span>
            </div>
          )}

          {geminiStatus === 'error' && <div className="modal-message error">Gemini: {geminiError}</div>}
          {claudeStatus === 'error' && <div className="modal-message error">Claude: {claudeError}</div>}

          {geminiResult && (
            <div className="ai-dual-result">
              <h4>Gemini-Analyse</h4>
              {geminiResult.duplikate?.length > 0 && (
                <div>
                  <strong>Duplikate:</strong>
                  <ul>
                    {geminiResult.duplikate.map((d, i) => (
                      <li key={i}>
                        {d.position_a} ↔ {d.position_b} — {d.begruendung}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {geminiResult.fehlende_positionen?.length > 0 && (
                <div>
                  <strong>Fehlende Positionen:</strong>
                  <ul>
                    {geminiResult.fehlende_positionen.map((f, i) => (
                      <li key={i}>
                        {f.position} — {f.begruendung}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {geminiResult.sprachliche_hinweise?.length > 0 && (
                <div>
                  <strong>Sprachliche Hinweise:</strong>
                  <ul>
                    {geminiResult.sprachliche_hinweise.map((s, i) => (
                      <li key={i}>
                        „{s.original}" → „{s.verbesserung}" ({s.grund})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {geminiResult.konsistenz_probleme?.length > 0 && (
                <div>
                  <strong>Konsistenzprobleme:</strong>
                  <ul>
                    {geminiResult.konsistenz_probleme.map((k, i) => (
                      <li key={i}>{k.beschreibung}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p>
                <strong>Bewertung:</strong> {geminiResult.bewertung}/10
              </p>
              {geminiResult.zusammenfassung && <p>{geminiResult.zusammenfassung}</p>}
            </div>
          )}

          {claudeResult && (
            <div className="ai-dual-result">
              <h4>Claude-Review</h4>
              {claudeResult.eigene_pruefung?.duplikate?.length > 0 && (
                <div>
                  <strong>Eigene Duplikat-Funde:</strong>
                  <ul>
                    {claudeResult.eigene_pruefung.duplikate.map((d, i) => (
                      <li key={i}>
                        {d.position_a} ↔ {d.position_b} — {d.begruendung}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {claudeResult.eigene_pruefung?.fehlende_positionen?.length > 0 && (
                <div>
                  <strong>Eigene fehlende Positionen:</strong>
                  <ul>
                    {claudeResult.eigene_pruefung.fehlende_positionen.map((f, i) => (
                      <li key={i}>
                        {f.position} — {f.begruendung}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {claudeResult.gemini_bewertung && (
                <div>
                  <strong>Abweichung zu Gemini:</strong>
                  {claudeResult.gemini_bewertung.korrekte_punkte?.length > 0 && (
                    <p>Korrekt: {claudeResult.gemini_bewertung.korrekte_punkte.join('; ')}</p>
                  )}
                  {claudeResult.gemini_bewertung.fehler_oder_uebertreibungen?.length > 0 && (
                    <p>Fehler/übertrieben: {claudeResult.gemini_bewertung.fehler_oder_uebertreibungen.join('; ')}</p>
                  )}
                  {claudeResult.gemini_bewertung.uebersehene_punkte?.length > 0 && (
                    <p>Übersehen: {claudeResult.gemini_bewertung.uebersehene_punkte.join('; ')}</p>
                  )}
                </div>
              )}
              {claudeResult.top_prioritaeten?.length > 0 && (
                <div>
                  <strong>Top 3 Prioritäten:</strong>
                  <ul>
                    {claudeResult.top_prioritaeten.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p>
                <strong>Freigabeempfehlung:</strong>{' '}
                {claudeResult.freigabe === 'bereit' ? '✓ Bereit' : '⚠ Überarbeitung empfohlen'}
                {claudeResult.freigabe_begruendung && ` — ${claudeResult.freigabe_begruendung}`}
              </p>
              {claudeResult.gesamtresumee && <p>{claudeResult.gesamtresumee}</p>}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  );
}

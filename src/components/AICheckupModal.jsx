import React, { useEffect, useState } from 'react';

export default function AICheckupModal({ sections, setSections, onClose }) {
  const [status, setStatus] = useState('loading');
  const [issues, setIssues] = useState([]);
  const [error, setError] = useState('');
  const [appliedIds, setAppliedIds] = useState({});

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch('/api/ai-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sections }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.error) {
          throw new Error(data?.error?.message || data?.error || 'Unbekannter Fehler');
        }
        if (!cancelled) {
          setIssues(Array.isArray(data?.issues) ? data.issues : []);
          setStatus('done');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || err?.toString() || 'Unbekannter Fehler');
          setStatus('error');
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <h2>KI Qualitätsprüfung</h2>

        {status === 'loading' && (
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

        <div className="modal-actions">
          <button onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  );
}

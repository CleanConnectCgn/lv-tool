import React, { useEffect, useState } from 'react';
import { listDbCustomers, runSevdeskLink, confirmSevdeskLink } from '../../lib/dbCrm.js';

const REASON_LABELS = {
  same_domain: 'gleiche Firmendomain',
  similar_name: 'ähnlicher Firmenname',
};

export default function DbCustomerList({ onBack, onOpenCustomer, onNewCustomer }) {
  const [customers, setCustomers] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const [linkStatus, setLinkStatus] = useState('idle'); // idle | running | done | error
  const [linkError, setLinkError] = useState('');
  const [autoLinked, setAutoLinked] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [confirming, setConfirming] = useState(null);

  function load() {
    setStatus('loading');
    listDbCustomers()
      .then((list) => {
        setCustomers(list);
        setStatus('done');
      })
      .catch((err) => {
        setError(err?.message || 'Fehler beim Laden');
        setStatus('error');
      });
  }

  useEffect(load, []);

  async function handleRunLink() {
    setLinkStatus('running');
    setLinkError('');
    try {
      const result = await runSevdeskLink();
      setAutoLinked(result.autoLinked);
      setSuggestions(result.suggestions);
      setLinkStatus('done');
      if (result.autoLinked.length > 0) load();
    } catch (err) {
      setLinkError(err?.message || 'sevDesk-Abgleich fehlgeschlagen');
      setLinkStatus('error');
    }
  }

  async function handleConfirm(s) {
    setConfirming(s.sevdeskContactId + s.customerId);
    try {
      await confirmSevdeskLink(s.customerId, s.sevdeskContactId);
      setSuggestions((prev) => prev.filter((x) => x !== s));
      load();
    } catch (err) {
      alert(err?.message || 'Verknüpfung fehlgeschlagen');
    } finally {
      setConfirming(null);
    }
  }

  function dismiss(s) {
    setSuggestions((prev) => prev.filter((x) => x !== s));
  }

  return (
    <div className="overview-page">
      <div className="overview-page-card">
        <h2>Kunden (Postgres, neu)</h2>
        <p className="modal-hint">
          Neuer Bereich auf Basis der neuen Datenbank (Block 5) - läuft parallel zum bestehenden CRM, bis die
          Altdaten migriert sind.
        </p>

        <div className="overview-actions">
          <button onClick={onBack}>Zurück</button>
          <button className="primary" onClick={onNewCustomer}>
            + Neuer Kunde
          </button>
          <button onClick={handleRunLink} disabled={linkStatus === 'running'}>
            {linkStatus === 'running' ? 'Gleicht ab...' : '🔗 sevDesk-Abgleich'}
          </button>
        </div>

        {linkStatus === 'error' && <div className="modal-message error">{linkError}</div>}
        {linkStatus === 'done' && (
          <div className="db-spec-card">
            <div className="ai-issue-header">sevDesk-Abgleich</div>
            <p>
              {autoLinked.length === 0
                ? 'Keine automatischen Verknüpfungen (exakte E-Mail-Übereinstimmung) gefunden.'
                : `${autoLinked.length} Kunde(n) automatisch verknüpft (E-Mail exakt gleich): ${autoLinked
                    .map((a) => a.customerName)
                    .join(', ')}`}
            </p>
            {suggestions.length > 0 && (
              <>
                <div className="modal-subheading">Vorschläge zur Bestätigung ({suggestions.length})</div>
                {suggestions.map((s) => (
                  <div
                    key={`${s.customerId}-${s.sevdeskContactId}`}
                    className="ai-issue-actions"
                    style={{ justifyContent: 'space-between', marginBottom: 6 }}
                  >
                    <span>
                      {s.customerName} ↔ {s.contactName} ({REASON_LABELS[s.reason] || s.reason})
                    </span>
                    <span style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => dismiss(s)}>Verwerfen</button>
                      <button
                        className="primary"
                        onClick={() => handleConfirm(s)}
                        disabled={confirming === s.sevdeskContactId + s.customerId}
                      >
                        Bestätigen
                      </button>
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {status === 'loading' && <p className="modal-hint">Lädt...</p>}
        {status === 'error' && <div className="modal-message error">{error}</div>}
        {status === 'done' && customers.length === 0 && (
          <p className="modal-hint">Noch keine Kunden in der neuen Datenbank angelegt.</p>
        )}

        {status === 'done' && customers.length > 0 && (
          <div className="overview-list">
            {customers.map((c) => (
              <div key={c.id} className="overview-row" onClick={() => onOpenCustomer(c.id)}>
                <div className="overview-row-main">
                  <div className="overview-row-title">
                    {c.name} {c.sevdeskContactId && <span title="Mit sevDesk verknüpft">🔗</span>}
                  </div>
                  <div className="overview-row-sub">
                    {c.objects?.length || 0} Objekt{c.objects?.length === 1 ? '' : 'e'}
                    {c.city ? ` · ${c.city}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { listAuftraege, updateAuftrag } from '../lib/crm.js';

const STATUS_OPTIONS = ['offen', 'in Arbeit', 'erledigt', 'storniert'];

function formatDateTimeDE(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function CrmAllAuftraege({ onBack, onOpenCustomer }) {
  const [auftraege, setAuftraege] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('alle');

  function load() {
    setStatus('loading');
    listAuftraege()
      .then((list) => {
        setAuftraege(list);
        setStatus('done');
      })
      .catch((err) => {
        setError(err?.message || 'Fehler beim Laden');
        setStatus('error');
      });
  }

  useEffect(load, []);

  async function handleStatusChange(auftrag, newStatus) {
    try {
      await updateAuftrag(auftrag.id, { status: newStatus });
      setAuftraege((prev) => prev.map((a) => (a.id === auftrag.id ? { ...a, status: newStatus } : a)));
    } catch (err) {
      alert(err?.message || 'Status konnte nicht geändert werden');
    }
  }

  const filtered = filter === 'alle' ? auftraege : auftraege.filter((a) => a.status === filter);

  return (
    <div className="overview-page">
      <div className="overview-page-card">
        <h2>Alle Aufträge</h2>
        <div className="modal-actions" style={{ marginBottom: 16 }}>
          <button onClick={onBack}>Zurück zur Übersicht</button>
        </div>

        <div className="modal-field-row" style={{ marginBottom: 16 }}>
          <label className="modal-field">
            Status filtern
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="alle">Alle</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        {status === 'loading' && <p className="modal-hint">Lädt...</p>}
        {status === 'error' && <div className="modal-message error">{error}</div>}
        {status === 'done' && filtered.length === 0 && <p className="modal-hint">Keine Aufträge.</p>}

        {status === 'done' &&
          filtered.map((a) => (
            <div key={a.id} className="ai-issue-card">
              <div className="ai-issue-header">
                <span
                  className="ai-issue-title"
                  style={{ cursor: 'pointer' }}
                  onClick={() => onOpenCustomer(a.customerKey)}
                >
                  {a.titel} — {a.customerName || 'Unbekannt'}
                </span>
              </div>
              <p className="ai-issue-desc">Angelegt: {formatDateTimeDE(a.createdAt)}</p>
              {a.calendarEventIds?.length > 0 && <p className="ai-issue-desc">📅 Kalendertermin verknüpft</p>}
              <label className="modal-field" style={{ maxWidth: 220 }}>
                Status
                <select value={a.status} onChange={(e) => handleStatusChange(a, e.target.value)}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ))}
      </div>
    </div>
  );
}

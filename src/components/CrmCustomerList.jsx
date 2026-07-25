import React, { useEffect, useState } from 'react';
import { listCustomers } from '../lib/crm.js';

function addressLine(c) {
  if (!c) return '';
  return [c.strasse || c.street, [c.plz || c.zip, c.ort || c.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
}

export default function CrmCustomerList({ onOpenCustomer, onBack, onOpenAuftraege, onOpenMitarbeiter, onOpenObjekte }) {
  const [customers, setCustomers] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    listCustomers()
      .then((list) => {
        setCustomers(list);
        setStatus('done');
      })
      .catch((err) => {
        setError(err?.message || 'Fehler beim Laden');
        setStatus('error');
      });
  }, []);

  const filtered = customers.filter((c) =>
    (c.customer?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="overview-page">
      <div className="overview-page-card">
        <h2>Kunden (CRM)</h2>
        <p className="modal-hint">Alle Kunden aus deinen Leistungsverzeichnissen und Angeboten.</p>

        <div className="modal-actions" style={{ marginBottom: 16 }}>
          <button onClick={onBack}>Zurück zur Übersicht</button>
          <button onClick={onOpenAuftraege}>Alle Aufträge</button>
          <button onClick={onOpenMitarbeiter}>Mitarbeiter</button>
          <button onClick={onOpenObjekte}>Alle Objekte</button>
        </div>

        <input
          type="text"
          placeholder="Kunde suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 16, width: '100%', maxWidth: 320 }}
        />

        {status === 'loading' && <p className="modal-hint">Lädt...</p>}
        {status === 'error' && <div className="modal-message error">{error}</div>}
        {status === 'done' && filtered.length === 0 && <p className="modal-hint">Keine Kunden gefunden.</p>}

        {status === 'done' && (
          <div className="overview-list">
            {filtered.map((c) => (
              <div key={c.key} className="overview-row" onClick={() => onOpenCustomer(c.key)}>
                <div className="overview-row-main">
                  <div className="overview-row-title">{c.customer?.name || 'Unbenannt'}</div>
                  <div className="overview-row-sub">{addressLine(c.customer)}</div>
                </div>
                <div className="overview-row-meta">
                  <span>
                    {c.orphan ? 'Kein Dokument (nur Aufträge/Objekte)' : `${c.documentCount} Dokument${c.documentCount === 1 ? '' : 'e'}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

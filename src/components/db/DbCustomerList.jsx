import React, { useEffect, useState } from 'react';
import { listDbCustomers } from '../../lib/dbCrm.js';

export default function DbCustomerList({ onBack, onOpenCustomer, onNewCustomer }) {
  const [customers, setCustomers] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

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
        </div>

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
                  <div className="overview-row-title">{c.name}</div>
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

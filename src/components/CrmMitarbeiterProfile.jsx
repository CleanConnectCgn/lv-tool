import React, { useEffect, useState } from 'react';
import { listMitarbeiter, listObjekte, listCustomers } from '../lib/crm.js';

function addressLine(o) {
  if (!o) return '';
  return [o.strasse, [o.plz, o.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

export default function CrmMitarbeiterProfile({ mitarbeiterId, onBack, onOpenCustomer }) {
  const [mitarbeiter, setMitarbeiter] = useState(null);
  const [objekte, setObjekte] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    setStatus('loading');
    Promise.all([listMitarbeiter(), listObjekte(), listCustomers()])
      .then(([alle, o, c]) => {
        const m = alle.find((x) => x.id === mitarbeiterId);
        if (!m) {
          setError('Mitarbeiter nicht gefunden');
          setStatus('error');
          return;
        }
        setMitarbeiter(m);
        setObjekte(o.filter((obj) => obj.mitarbeiterIds.includes(mitarbeiterId)));
        setCustomers(c);
        setStatus('done');
      })
      .catch((err) => {
        setError(err?.message || 'Fehler beim Laden');
        setStatus('error');
      });
  }, [mitarbeiterId]);

  function customerName(key) {
    return customers.find((c) => c.key === key)?.customer?.name || 'Unbekannter Kunde';
  }

  return (
    <div className="overview-page">
      <div className="overview-page-card">
        <div className="modal-actions" style={{ marginBottom: 16 }}>
          <button onClick={onBack}>Zurück zu Mitarbeitern</button>
        </div>

        {status === 'loading' && <p className="modal-hint">Lädt...</p>}
        {status === 'error' && <div className="modal-message error">{error}</div>}

        {status === 'done' && (
          <>
            <h2>{mitarbeiter.name}</h2>
            <p className="modal-hint">
              {[mitarbeiter.telefon, mitarbeiter.email].filter(Boolean).join(' · ') || 'Keine Kontaktdaten'}
              {!mitarbeiter.aktiv && ' · inaktiv'}
            </p>

            <hr className="modal-section-divider" />
            <div className="modal-subheading">Zugewiesene Objekte ({objekte.length})</div>
            {objekte.length === 0 && <p className="modal-hint">Keine Objekte zugewiesen.</p>}
            {objekte.map((o) => (
              <div key={o.id} className="overview-row" onClick={() => onOpenCustomer(o.customerKey)}>
                <div className="overview-row-main">
                  <div className="overview-row-title">{o.name}</div>
                  <div className="overview-row-sub">
                    {customerName(o.customerKey)} · {addressLine(o) || 'keine Adresse'}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

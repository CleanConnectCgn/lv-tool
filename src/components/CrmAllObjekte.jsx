import React, { useEffect, useState } from 'react';
import { listObjekte, listMitarbeiter } from '../lib/crm.js';

function addressLine(o) {
  if (!o) return '';
  return [o.strasse, [o.plz, o.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

export default function CrmAllObjekte({ onBack, onOpenCustomer }) {
  const [objekte, setObjekte] = useState([]);
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    setStatus('loading');
    Promise.all([listObjekte(), listMitarbeiter()])
      .then(([o, m]) => {
        setObjekte(o);
        setMitarbeiter(m);
        setStatus('done');
      })
      .catch((err) => {
        setError(err?.message || 'Fehler beim Laden');
        setStatus('error');
      });
  }, []);

  function mitarbeiterNamen(ids) {
    return ids.map((id) => mitarbeiter.find((m) => m.id === id)?.name).filter(Boolean).join(', ');
  }

  return (
    <div className="overview-page">
      <div className="overview-page-card">
        <h2>Alle Objekte</h2>
        <div className="modal-actions" style={{ marginBottom: 16 }}>
          <button onClick={onBack}>Zurück zur Übersicht</button>
        </div>

        {status === 'loading' && <p className="modal-hint">Lädt...</p>}
        {status === 'error' && <div className="modal-message error">{error}</div>}
        {status === 'done' && objekte.length === 0 && <p className="modal-hint">Keine Objekte angelegt.</p>}

        {status === 'done' &&
          objekte.map((o) => (
            <div key={o.id} className="overview-row" onClick={() => onOpenCustomer(o.customerKey)}>
              <div className="overview-row-main">
                <div className="overview-row-title">{o.name}</div>
                <div className="overview-row-sub">
                  {addressLine(o)}
                  {o.mitarbeiterIds.length > 0 ? ` · ${mitarbeiterNamen(o.mitarbeiterIds)}` : ' · keine Zuweisung'}
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { listMitarbeiter, createMitarbeiter, updateMitarbeiter, deleteMitarbeiter } from '../lib/crm.js';

export default function CrmMitarbeiter({ onBack, onOpenMitarbeiter }) {
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [telefon, setTelefon] = useState('');
  const [email, setEmail] = useState('');

  function load() {
    setStatus('loading');
    listMitarbeiter()
      .then((list) => {
        setMitarbeiter(list);
        setStatus('done');
      })
      .catch((err) => {
        setError(err?.message || 'Fehler beim Laden');
        setStatus('error');
      });
  }

  useEffect(load, []);

  async function handleCreate() {
    if (!name.trim()) return;
    try {
      await createMitarbeiter({ name: name.trim(), telefon, email });
      setName('');
      setTelefon('');
      setEmail('');
      setShowNew(false);
      load();
    } catch (err) {
      alert(err?.message || 'Mitarbeiter konnte nicht angelegt werden');
    }
  }

  async function handleToggleAktiv(m) {
    try {
      await updateMitarbeiter(m.id, { aktiv: !m.aktiv });
      load();
    } catch (err) {
      alert(err?.message || 'Status konnte nicht geändert werden');
    }
  }

  async function handleDelete(m) {
    if (!window.confirm(`Mitarbeiter "${m.name}" wirklich löschen? Zuweisungen zu Objekten werden entfernt.`)) return;
    try {
      await deleteMitarbeiter(m.id);
      load();
    } catch (err) {
      alert(err?.message || 'Mitarbeiter konnte nicht gelöscht werden');
    }
  }

  return (
    <div className="overview-page">
      <div className="overview-page-card">
        <h2>Mitarbeiter</h2>
        <div className="modal-actions" style={{ marginBottom: 16 }}>
          <button onClick={onBack}>Zurück</button>
        </div>

        {status === 'loading' && <p className="modal-hint">Lädt...</p>}
        {status === 'error' && <div className="modal-message error">{error}</div>}

        {status === 'done' &&
          mitarbeiter.map((m) => (
            <div key={m.id} className="overview-row" onClick={() => onOpenMitarbeiter(m.id)}>
              <div className="overview-row-main">
                <div className="overview-row-title">{m.name}</div>
                <div className="overview-row-sub">
                  {[m.telefon, m.email].filter(Boolean).join(' · ') || 'Keine Kontaktdaten'}
                  {!m.aktiv && ' · inaktiv'}
                </div>
              </div>
              <div className="overview-row-meta" onClick={(e) => e.stopPropagation()}>
                <button className="icon-btn" onClick={() => handleToggleAktiv(m)}>
                  {m.aktiv ? 'Deaktivieren' : 'Aktivieren'}
                </button>
                <button className="icon-btn" onClick={() => handleDelete(m)}>
                  Löschen
                </button>
              </div>
            </div>
          ))}

        {!showNew && (
          <button type="button" onClick={() => setShowNew(true)}>
            + Mitarbeiter anlegen
          </button>
        )}
        {showNew && (
          <div className="import-box">
            <label className="modal-field">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vor- und Nachname" />
            </label>
            <div className="modal-field-row">
              <label className="modal-field">
                Telefon
                <input value={telefon} onChange={(e) => setTelefon(e.target.value)} />
              </label>
              <label className="modal-field">
                E-Mail
                <input value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowNew(false)}>Abbrechen</button>
              <button className="primary" onClick={handleCreate}>
                Anlegen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

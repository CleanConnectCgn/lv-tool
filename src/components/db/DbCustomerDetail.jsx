import React, { useEffect, useState } from 'react';
import { getDbCustomer, createDbObject, bulkCreateDbObjects } from '../../lib/dbCrm.js';

export default function DbCustomerDetail({ customerId, onBack, onOpenObject }) {
  const [customer, setCustomer] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const [showAddObject, setShowAddObject] = useState(false);
  const [street, setStreet] = useState('');
  const [zip, setZip] = useState('');
  const [city, setCity] = useState('');
  const [label, setLabel] = useState('');

  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkResult, setBulkResult] = useState(null);
  const [saving, setSaving] = useState(false);

  function load() {
    setStatus('loading');
    getDbCustomer(customerId)
      .then((c) => {
        setCustomer(c);
        setStatus('done');
      })
      .catch((err) => {
        setError(err?.message || 'Fehler beim Laden');
        setStatus('error');
      });
  }

  useEffect(load, [customerId]);

  async function handleAddObject(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await createDbObject({ customerId, street, zip, city, label });
      setStreet('');
      setZip('');
      setCity('');
      setLabel('');
      setShowAddObject(false);
      load();
    } catch (err) {
      alert(err?.message || 'Objekt konnte nicht angelegt werden');
    } finally {
      setSaving(false);
    }
  }

  async function handleBulkCreate(e) {
    e.preventDefault();
    setSaving(true);
    setBulkResult(null);
    try {
      const result = await bulkCreateDbObjects(customerId, bulkText);
      setBulkResult(result);
      setBulkText('');
      load();
    } catch (err) {
      alert(err?.message || 'Sammelanlage fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading') return <div className="overview-page"><p className="modal-hint">Lädt...</p></div>;
  if (status === 'error') return <div className="overview-page"><div className="modal-message error">{error}</div></div>;

  return (
    <div className="overview-page">
      <div className="overview-page-card">
        <h2>{customer.name}</h2>
        <p className="modal-hint">
          {[customer.street, [customer.zip, customer.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') ||
            'Keine Rechnungsadresse hinterlegt'}
        </p>

        <div className="overview-actions">
          <button onClick={onBack}>Zurück</button>
          <button onClick={() => setShowAddObject((v) => !v)}>+ Objekt hinzufügen</button>
          <button onClick={() => setShowBulk((v) => !v)}>+ Sammelanlage</button>
        </div>

        {showAddObject && (
          <form className="import-box" onSubmit={handleAddObject} style={{ marginBottom: 16 }}>
            <label className="modal-field">
              Straße
              <input value={street} onChange={(e) => setStreet(e.target.value)} required />
            </label>
            <div className="modal-field-row">
              <label className="modal-field">
                PLZ
                <input value={zip} onChange={(e) => setZip(e.target.value)} required />
              </label>
              <label className="modal-field">
                Ort
                <input value={city} onChange={(e) => setCity(e.target.value)} required />
              </label>
            </div>
            <label className="modal-field">
              Kurzname (optional)
              <input value={label} onChange={(e) => setLabel(e.target.value)} />
            </label>
            <div className="modal-actions">
              <button type="submit" className="primary" disabled={saving}>
                Anlegen
              </button>
            </div>
          </form>
        )}

        {showBulk && (
          <form className="import-box" onSubmit={handleBulkCreate} style={{ marginBottom: 16 }}>
            <label className="modal-field">
              Eine Adresse je Zeile (Format: Straße, PLZ Ort)
              <textarea
                rows={5}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={'Musterstraße 1, 50667 Köln\nBeispielweg 2, 50668 Köln'}
                required
              />
            </label>
            <div className="modal-actions">
              <button type="submit" className="primary" disabled={saving}>
                {saving ? 'Legt an...' : 'Objekte anlegen'}
              </button>
            </div>
          </form>
        )}

        {bulkResult && (
          <div className={`modal-message ${bulkResult.failed.length ? 'error' : 'success'}`}>
            {bulkResult.created.length} Objekt(e) angelegt.
            {bulkResult.failed.length > 0 && (
              <>
                {' '}
                Übersprungen: {bulkResult.failed.map((f) => `"${f.line}" (${f.reason})`).join('; ')}
              </>
            )}
          </div>
        )}

        <div className="modal-subheading" style={{ marginTop: 16 }}>
          Objekte ({customer.objects.length})
        </div>
        <div className="overview-list">
          {customer.objects.map((o) => (
            <div key={o.id} className="overview-row" onClick={() => onOpenObject(o.id)}>
              <div className="overview-row-main">
                <div className="overview-row-title">{o.label}</div>
                <div className="overview-row-sub">
                  {o.street}, {o.zip} {o.city}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import {
  getDbCustomer,
  createDbObject,
  bulkCreateDbObjects,
  unlinkSevdesk,
  listCustomerDocuments,
  uploadCustomerDocument,
} from '../../lib/dbCrm.js';

function formatDateTimeDE(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function DbCustomerDetail({ customerId, onBack, onOpenObject }) {
  const [customer, setCustomer] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const [documents, setDocuments] = useState(null); // null = noch nicht geladen/nicht erreichbar
  const [documentsError, setDocumentsError] = useState('');
  const [uploadingDocument, setUploadingDocument] = useState(false);

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

  function loadDocuments() {
    setDocumentsError('');
    listCustomerDocuments(customerId)
      .then((r) => setDocuments(r.files))
      .catch((err) => {
        setDocuments(null);
        setDocumentsError(err?.message || 'Dokumente konnten nicht geladen werden');
      });
  }

  useEffect(loadDocuments, [customerId]);

  async function handleUploadDocument(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingDocument(true);
    try {
      await uploadCustomerDocument(customerId, file);
      loadDocuments();
    } catch (err) {
      alert(err?.message || 'Dokument konnte nicht hochgeladen werden');
    } finally {
      setUploadingDocument(false);
    }
  }

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
        <p className="modal-hint">
          {customer.sevdeskContactId ? (
            <>
              🔗 Mit sevDesk-Kontakt {customer.sevdeskContactId} verknüpft ·{' '}
              <button
                className="icon-btn"
                onClick={async () => {
                  if (!window.confirm('Verknüpfung zu sevDesk wirklich trennen?')) return;
                  await unlinkSevdesk(customerId);
                  load();
                }}
              >
                Trennen
              </button>
            </>
          ) : (
            'Nicht mit sevDesk verknüpft'
          )}
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

        <div className="modal-subheading" style={{ marginTop: 16 }}>
          Dokumente (Google Drive)
        </div>
        <p className="modal-hint">
          Verträge, Leistungsverzeichnisse und Angebote landen hier automatisch. Scans (z.B.
          Schlüsselübergabeprotokolle, unterschriebene Papierverträge) können manuell hochgeladen werden.
        </p>
        <label className="import-toggle-btn" style={{ display: 'inline-block', cursor: 'pointer' }}>
          {uploadingDocument ? 'Lädt hoch...' : '📎 Dokument hochladen'}
          <input type="file" onChange={handleUploadDocument} disabled={uploadingDocument} style={{ display: 'none' }} />
        </label>

        {documentsError && <div className="modal-message error">{documentsError}</div>}
        {documents !== null && (
          <div className="overview-list" style={{ marginTop: 12 }}>
            {documents.length === 0 && <p className="modal-hint">Noch keine Dokumente in Drive.</p>}
            {documents.map((f) => (
              <a
                key={f.id}
                className="overview-row"
                href={f.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="overview-row-main">
                  <div className="overview-row-title">{f.name}</div>
                </div>
                <div className="overview-row-meta">
                  <span>{formatDateTimeDE(f.createdTime)}</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { listDocuments, deleteDocument } from '../lib/documents.js';

function formatDateDE(isoStr) {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-');
  if (!y || !m || !d) return isoStr;
  return `${d}.${m}.${y}`;
}

function formatUpdatedAt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function Overview({ onClose, onOpen, onNew }) {
  const [docs, setDocs] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  function load() {
    setStatus('loading');
    listDocuments()
      .then((list) => {
        setDocs(list);
        setStatus('done');
      })
      .catch((err) => {
        setError(err?.message || 'Fehler beim Laden');
        setStatus('error');
      });
  }

  useEffect(load, []);

  function handleDeleteClick(e, id) {
    e.stopPropagation();
    setConfirmDeleteId(id);
  }

  async function handleConfirmDelete(e, id) {
    e.stopPropagation();
    try {
      await deleteDocument(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError(err?.message || 'Löschen fehlgeschlagen');
    } finally {
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal overview-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Übersicht</h2>
        <p className="modal-hint">Gespeicherte Leistungsverzeichnisse und Angebote.</p>

        <div className="overview-actions">
          <button className="primary" onClick={onNew}>
            + Neues Leistungsverzeichnis
          </button>
        </div>

        {status === 'loading' && <p className="modal-hint">Lädt...</p>}
        {status === 'error' && <div className="modal-message error">{error}</div>}

        {status === 'done' && docs.length === 0 && (
          <p className="modal-hint">Noch keine gespeicherten Datensätze.</p>
        )}

        {status === 'done' && docs.length > 0 && (
          <div className="overview-list">
            {docs.map((d) => (
              <div key={d.id} className="overview-row" onClick={() => onOpen(d.id)}>
                <div className="overview-row-main">
                  <div className="overview-row-title">{d.objekt || 'Ohne Objekt'}</div>
                  <div className="overview-row-sub">
                    {d.lvTitle}
                    {d.offerNumber ? ` · Angebot ${d.offerNumber}` : ''}
                    {d.contactName ? ` · ${d.contactName}` : ''}
                  </div>
                </div>
                <div className="overview-row-meta">
                  <span>Stand {formatDateDE(d.datum)}</span>
                  <span>Zuletzt bearbeitet {formatUpdatedAt(d.updatedAt)}</span>
                </div>
                {confirmDeleteId === d.id ? (
                  <button
                    className="overview-delete-confirm"
                    onClick={(e) => handleConfirmDelete(e, d.id)}
                    onMouseLeave={() => setConfirmDeleteId(null)}
                  >
                    Wirklich löschen?
                  </button>
                ) : (
                  <button className="icon-btn overview-delete" onClick={(e) => handleDeleteClick(e, d.id)}>
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  );
}

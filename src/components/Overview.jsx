import React, { useEffect, useState } from 'react';
import { listDocuments, deleteDocument } from '../lib/documents.js';
import MiniGame from './MiniGame.jsx';
import ExportedPdfsList from './ExportedPdfsList.jsx';

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

export default function Overview({ onClose, onOpen, onNew, onInspect, variant = 'modal' }) {
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

  const content = (
    <div className={variant === 'page' ? 'overview-page-card' : 'modal overview-modal'} onClick={(e) => e.stopPropagation()}>
      <h2>Übersicht</h2>
      <p className="modal-hint">Gespeicherte Leistungsverzeichnisse und Angebote.</p>

      <div className="overview-actions">
        <button className="primary" onClick={onNew}>
          + Neues Leistungsverzeichnis
        </button>
        {onInspect && <button onClick={onInspect}>Besichtigungsmodus</button>}
      </div>

      {status === 'loading' && <p className="modal-hint">Lädt...</p>}
      {status === 'error' && <div className="modal-message error">{error}</div>}

      {status === 'done' && docs.length === 0 && (
        <p className="modal-hint">Noch keine gespeicherten Datensätze.</p>
      )}

      {status === 'done' && docs.length > 0 && (
        <div className="overview-list">
          {(() => {
            const ids = new Set(docs.map((d) => d.id));
            const topLevel = docs.filter((d) => !d.parentId || !ids.has(d.parentId));
            const childrenOf = (parentId) => docs.filter((d) => d.parentId === parentId);
            const renderRow = (d, nested) => (
              <div
                key={d.id}
                className={`overview-row${nested ? ' overview-row-nested' : ''}`}
                onClick={() => onOpen(d.id)}
              >
                <div className="overview-row-main">
                  <div className="overview-row-title">
                    {nested ? d.lvTitle : d.objekt || 'Ohne Objekt'}
                  </div>
                  <div className="overview-row-sub">
                    {!nested && d.lvTitle}
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
            );
            return topLevel.map((d) => (
              <div key={d.id} className="overview-group">
                {renderRow(d, false)}
                {childrenOf(d.id).map((c) => renderRow(c, true))}
              </div>
            ));
          })()}
        </div>
      )}

      {variant === 'page' && (
        <>
          <ExportedPdfsList />
          <MiniGame />
        </>
      )}

      {variant !== 'page' && (
        <div className="modal-actions">
          <button onClick={onClose}>Schließen</button>
        </div>
      )}
    </div>
  );

  if (variant === 'page') {
    return <div className="overview-page">{content}</div>;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      {content}
    </div>
  );
}

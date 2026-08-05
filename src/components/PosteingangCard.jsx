import React, { useEffect, useRef, useState } from 'react';
import {
  uploadInboxDocument,
  listInboxDocuments,
  confirmInboxDocument,
  rejectInboxDocument,
  listDbCustomers,
} from '../lib/dbCrm.js';

// Eingangs-Ablage direkt in der Übersicht: Datei reinwerfen (z.B. ein
// Schlüsselübergabeprotokoll), Gemini liest Kunde/Objekt/Dokumenttyp aus
// (server/lib/inbox.js), passende Kunden werden vorgeschlagen - erst nach
// Klick auf "Bestätigen" landet die Datei im Drive-Kundenordner.
export default function PosteingangCard() {
  const [docs, setDocs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [manualPick, setManualPick] = useState({});
  const fileInputRef = useRef(null);
  const pollTimer = useRef(null);

  async function refresh() {
    try {
      const [inboxDocs, custList] = await Promise.all([listInboxDocuments(), listDbCustomers()]);
      setDocs(inboxDocs);
      setCustomers(custList);
    } catch {
      // Stiller Fehler beim Hintergrund-Polling - der letzte bekannte Stand
      // bleibt sichtbar, keine Fehlermeldung bei jedem Poll-Tick.
    }
  }

  useEffect(() => {
    refresh();
    // Solange noch Dokumente ohne Auslese-Ergebnis offen sind, alle 4s
    // neu laden, damit das Gemini-Ergebnis (läuft im Hintergrund, siehe
    // server/lib/inbox.js) ohne manuellen Reload im UI ankommt.
    pollTimer.current = setInterval(refresh, 4000);
    return () => clearInterval(pollTimer.current);
  }, []);

  async function handleFiles(files) {
    setError('');
    setUploading(true);
    try {
      for (const file of files) {
        await uploadInboxDocument(file);
      }
      await refresh();
    } catch (err) {
      setError(err.message || 'Upload fehlgeschlagen');
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirm(docId, customerId) {
    if (!customerId) return;
    setError('');
    try {
      await confirmInboxDocument(docId, customerId);
      await refresh();
    } catch (err) {
      setError(err.message || 'Bestätigung fehlgeschlagen');
    }
  }

  async function handleReject(docId) {
    setError('');
    try {
      await rejectInboxDocument(docId);
      await refresh();
    } catch (err) {
      setError(err.message || 'Ablehnen fehlgeschlagen');
    }
  }

  return (
    <div className="overview-page-card posteingang-card">
      <div className="modal-subheading">📥 Posteingang</div>
      <p className="modal-hint">
        Dokumente ohne festen Ablageort hier reinwerfen (z.B. ein Schlüsselübergabeprotokoll) - die KI schlägt
        den passenden Kunden vor, nach Bestätigung landet die Datei in dessen Google-Drive-Ordner.
      </p>

      <div
        className={`posteingang-dropzone${dragOver ? ' drag-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) handleFiles(Array.from(e.dataTransfer.files));
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        {uploading ? 'Lädt hoch...' : 'Datei hierher ziehen oder klicken zum Auswählen'}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="application/pdf,image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(Array.from(e.target.files));
            e.target.value = '';
          }}
        />
      </div>

      {error && <div className="overview-delete-confirm">{error}</div>}

      {docs.length > 0 && (
        <div className="posteingang-list">
          {docs.map((doc) => {
            const candidates = doc.matchCandidates || [];
            const bestGuess = doc.matchedCustomer;
            const selected = manualPick[doc.id] || doc.matchedCustomerId || '';
            const stillReading = doc.extractedCustomerName == null && doc.extractedDocType == null;
            return (
              <div key={doc.id} className="posteingang-item">
                <div className="posteingang-item-header">
                  <strong>{doc.filename}</strong>
                  {stillReading && <span className="modal-hint"> — liest aus...</span>}
                </div>
                {!stillReading && (
                  <div className="modal-hint">
                    {doc.extractedDocType || 'Dokumenttyp unbekannt'}
                    {doc.extractedCustomerName ? ` → ${doc.extractedCustomerName}` : ''}
                    {doc.extractedDate ? ` (${doc.extractedDate})` : ''}
                  </div>
                )}
                <div className="posteingang-item-actions">
                  <select value={selected} onChange={(e) => setManualPick((m) => ({ ...m, [doc.id]: e.target.value }))}>
                    <option value="">Kunde wählen...</option>
                    {candidates.map((c) => (
                      <option key={c.customerId} value={c.customerId}>
                        {c.name} ({Math.round(c.score * 100)}% Übereinstimmung)
                      </option>
                    ))}
                    {customers
                      .filter((c) => !candidates.some((cand) => cand.customerId === c.id))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    className="primary"
                    disabled={!selected}
                    onClick={() => handleConfirm(doc.id, selected)}
                  >
                    Bestätigen
                  </button>
                  <button type="button" onClick={() => handleReject(doc.id)}>
                    Ablehnen
                  </button>
                </div>
                {bestGuess && !manualPick[doc.id] && (
                  <div className="modal-hint">Vorschlag: {bestGuess.name}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

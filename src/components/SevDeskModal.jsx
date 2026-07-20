import React, { useState } from 'react';

function buildOfferPayload(objekt, datum, sections) {
  const positions = [];
  sections.forEach((section) => {
    section.rows.forEach((row) => {
      if (!row.text.trim()) return;
      const intervalParts = [];
      if (row.bedarf) intervalParts.push('Bei Bedarf');
      if (row.woechentlich) intervalParts.push(`Wöchentlich: ${row.woechentlich}`);
      if (row.monatlich) intervalParts.push(`Monatlich: ${row.monatlich}`);
      if (row.jaehrlich) intervalParts.push(`Jährlich: ${row.jaehrlich}`);
      const nameParts = [`[${section.title}] ${row.text}`];
      if (intervalParts.length) nameParts.push(`(${intervalParts.join(', ')})`);
      if (row.bemerkung) nameParts.push(`- ${row.bemerkung}`);
      positions.push({
        name: nameParts.join(' '),
        quantity: 1,
        price: 0,
      });
    });
  });

  return {
    offer: {
      objectName: 'Offer',
      status: 100,
      header: `Leistungsverzeichnis ${objekt || ''}`.trim(),
      headText: `Leistungsverzeichnis für ${objekt || 'Objekt'} vom ${datum}`,
    },
    positions,
  };
}

export default function SevDeskModal({ onClose, objekt, datum, sections }) {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit() {
    if (!token.trim()) {
      setMessage('Bitte API-Token eingeben.');
      return;
    }
    setStatus('loading');
    setMessage('');
    try {
      const payload = buildOfferPayload(objekt, datum, sections);
      const res = await fetch('/api/sevdesk/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, payload }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setMessage('Angebot erfolgreich in sevDesk erstellt.');
      } else {
        setStatus('error');
        setMessage(data.error || data.message || 'Fehler beim Erstellen des Angebots.');
      }
    } catch (err) {
      setStatus('error');
      setMessage(String(err));
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>An sevDesk senden</h2>
        <p className="modal-hint">
          Erstellt ein Angebot in sevDesk basierend auf diesem Leistungsverzeichnis.
        </p>
        <label className="modal-field">
          sevDesk API-Token
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="API-Token einfügen"
          />
        </label>
        {message && <div className={`modal-message ${status}`}>{message}</div>}
        <div className="modal-actions">
          <button onClick={onClose}>Abbrechen</button>
          <button className="primary" onClick={handleSubmit} disabled={status === 'loading'}>
            {status === 'loading' ? 'Sende...' : 'Angebot erstellen'}
          </button>
        </div>
      </div>
    </div>
  );
}

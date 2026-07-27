import React, { useState } from 'react';
import { createContract, contractDocxUrl } from '../../lib/dbCrm.js';

// Block 8: sammelt genau die im Auftrag als variabel erlaubten Felder
// (Ueberschrift, Leistungsart, Intervall, Preis, Zahlungsziel, Laufzeit,
// Kuendigungsfrist, Leistungsbeginn, Ansprechpartner) - Kunde/Objekt/
// Anschrift kommen serverseitig aus dem Objekt, Vertragsnummer wird
// serverseitig erzeugt. Haftung/Gewaehrleistung/Schlussbestimmungen sind im
// Renderer fest und hier nicht editierbar.
export default function DbContractForm({ objectId, defaultLeistungsart, defaultLvDatum, onClose }) {
  const [leistungsart, setLeistungsart] = useState(defaultLeistungsart || 'Unterhaltsreinigung');
  const [reinigungsintervall, setReinigungsintervall] = useState('');
  const [verguetungNetto, setVerguetungNetto] = useState('');
  const [vertragsbeginn, setVertragsbeginn] = useState('');
  const [kuendigungsfristMonate, setKuendigungsfristMonate] = useState(2);
  const [laufzeitMonate, setLaufzeitMonate] = useState('');
  const [zahlungszielWerktage, setZahlungszielWerktage] = useState('');
  const [internerAnsprechpartner, setInternerAnsprechpartner] = useState('');
  const [dsgvoVariante, setDsgvoVariante] = useState('standard');
  const [status, setStatus] = useState('idle'); // idle | saving | done | error
  const [error, setError] = useState('');
  const [contractId, setContractId] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('saving');
    setError('');
    try {
      const result = await createContract(objectId, {
        leistungsart,
        reinigungsintervall,
        verguetungNetto: verguetungNetto || null,
        vertragsbeginn: vertragsbeginn || null,
        kuendigungsfristMonate: Number(kuendigungsfristMonate) || 2,
        laufzeitMonate: laufzeitMonate ? Number(laufzeitMonate) : null,
        zahlungszielWerktage: zahlungszielWerktage ? Number(zahlungszielWerktage) : null,
        internerAnsprechpartner,
        dsgvoVariante,
        lvDatum: defaultLvDatum || null,
      });
      setContractId(result.contract.id);
      setStatus('done');
    } catch (err) {
      setError(err?.message || 'Vertrag konnte nicht angelegt werden');
      setStatus('error');
    }
  }

  if (status === 'done' && contractId) {
    return (
      <div className="import-box">
        <div className="modal-message success">Vertrag angelegt.</div>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Schließen
          </button>
          <a href={contractDocxUrl(contractId)}>
            <button type="button" className="primary">
              Als DOCX herunterladen
            </button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <form className="import-box" onSubmit={handleSubmit}>
      <div className="modal-subheading">Vertrag erstellen</div>
      {error && <div className="modal-message error">{error}</div>}

      <div className="modal-field-row">
        <label className="modal-field">
          Leistungsart
          <input value={leistungsart} onChange={(e) => setLeistungsart(e.target.value)} />
        </label>
        <label className="modal-field">
          Intervall
          <input value={reinigungsintervall} onChange={(e) => setReinigungsintervall(e.target.value)} placeholder="z.B. 2x wöchentlich" />
        </label>
        <label className="modal-field">
          Preis (netto, EUR/Monat)
          <input type="number" step="0.01" value={verguetungNetto} onChange={(e) => setVerguetungNetto(e.target.value)} />
        </label>
      </div>
      <div className="modal-field-row">
        <label className="modal-field">
          Leistungsbeginn
          <input type="date" value={vertragsbeginn} onChange={(e) => setVertragsbeginn(e.target.value)} />
        </label>
        <label className="modal-field">
          Kündigungsfrist (Monate)
          <input type="number" min="1" value={kuendigungsfristMonate} onChange={(e) => setKuendigungsfristMonate(e.target.value)} />
        </label>
        <label className="modal-field">
          Laufzeit (Monate, leer = unbestimmt)
          <input type="number" min="1" value={laufzeitMonate} onChange={(e) => setLaufzeitMonate(e.target.value)} />
        </label>
      </div>
      <div className="modal-field-row">
        <label className="modal-field">
          Zahlungsziel (Werktage, leer = Standard)
          <input type="number" min="1" value={zahlungszielWerktage} onChange={(e) => setZahlungszielWerktage(e.target.value)} />
        </label>
        <label className="modal-field">
          Ansprechpartner (intern)
          <input value={internerAnsprechpartner} onChange={(e) => setInternerAnsprechpartner(e.target.value)} />
        </label>
        <label className="modal-field">
          Datenschutz-Klausel
          <select value={dsgvoVariante} onChange={(e) => setDsgvoVariante(e.target.value)}>
            <option value="standard">Standard (Büro/Gewerbe)</option>
            <option value="gesundheitsdaten">Arztpraxis (Verschwiegenheit, AVV)</option>
            <option value="mandantendaten">Kanzlei (Mandantendaten, AVV)</option>
            <option value="minderjaehrige">Kindergarten/Schule (AVV)</option>
          </select>
        </label>
      </div>

      <div className="modal-actions">
        <button type="button" onClick={onClose}>
          Abbrechen
        </button>
        <button type="submit" className="primary" disabled={status === 'saving'}>
          {status === 'saving' ? 'Erstellt...' : 'Vertrag erstellen'}
        </button>
      </div>
    </form>
  );
}

import React, { useState } from 'react';
import { createContract, contractPdfUrl, avvPdfUrl, runContractAiReview } from '../../lib/dbCrm.js';
import { listOffersForContact } from '../../lib/sevdesk.js';

const SEVDESK_TOKEN_KEY = 'lv-tool:sevdesk-token';

// Block 8: sammelt genau die im Auftrag als variabel erlaubten Felder
// (Ueberschrift, Leistungsart, Intervall, Preis, Zahlungsziel, Laufzeit,
// Kuendigungsfrist, Leistungsbeginn, Ansprechpartner) - Kunde/Objekt/
// Anschrift kommen serverseitig aus dem Objekt, Vertragsnummer wird
// serverseitig erzeugt. Haftung/Gewaehrleistung/Schlussbestimmungen sind im
// Renderer fest und hier nicht editierbar.
//
// Lokale Kopie von BRANCHEN/BRANCHE_ZU_DSGVO/braucht_avv statt Import aus
// server/lib/render/contractFields.js - gleiches Muster wie die schon
// bisher hier fest hinterlegten Datenschutz-Klausel-Optionen (Server- und
// Client-Bundle sind getrennt). Praxis-Typen am 2026-07-31 wieder in
// eigene Branchen aufgesplittet (vorher eine gemeinsame "praxis"-Branche) -
// Rückfrage beantwortet: der echte Referenzvertrag benennt in § 7.2 konkret
// den jeweiligen Praxis-Typ, eine Sammelformulierung wirkte unpräzise.
const BRANCHEN = [
  { key: 'buero', label: 'Büro' },
  { key: 'treppenhaus', label: 'Treppenhaus / Wohnanlage' },
  { key: 'gewerbehalle', label: 'Gewerbehalle / Produktion' },
  { key: 'physiotherapiepraxis', label: 'Physiotherapiepraxis' },
  { key: 'arztpraxis', label: 'Arztpraxis' },
  { key: 'psychologenpraxis', label: 'Psychologen-/Psychotherapiepraxis' },
  { key: 'sonstiges', label: 'Sonstiges' },
];
const BRANCHE_ZU_DSGVO = {
  buero: 'standard',
  treppenhaus: 'standard',
  gewerbehalle: 'standard',
  physiotherapiepraxis: 'physiotherapiepraxis',
  arztpraxis: 'arztpraxis',
  psychologenpraxis: 'psychologenpraxis',
  sonstiges: 'standard',
};
const DSGVO_BRAUCHT_AVV = {
  standard: false,
  physiotherapiepraxis: true,
  arztpraxis: true,
  psychologenpraxis: true,
};

export default function DbContractForm({ objectId, sevdeskContactId, defaultLeistungsart, defaultLvDatum, onClose }) {
  const [branche, setBranche] = useState('buero');
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
  const [warnings, setWarnings] = useState([]);

  // Angebot (Anlage 2) - statt Angebotsnummer/-datum manuell einzutippen,
  // direkt aus einem bereits existierenden sevDesk-Angebot dieses Kunden
  // übernehmen (Kundenwunsch: schnell, präzise, ohne Doppeleingabe).
  const [angebotNummer, setAngebotNummer] = useState('');
  const [angebotDatum, setAngebotDatum] = useState('');
  const [offers, setOffers] = useState(null); // null = noch nicht geladen
  const [offersStatus, setOffersStatus] = useState('idle'); // idle | loading | error
  const [offersError, setOffersError] = useState('');

  async function handleLoadOffers() {
    setOffersStatus('loading');
    setOffersError('');
    try {
      const token = localStorage.getItem(SEVDESK_TOKEN_KEY);
      if (!token) throw new Error('Kein sevDesk-Token hinterlegt - erst im Angebots-Dialog verbinden.');
      if (!sevdeskContactId) throw new Error('Dieser Kunde ist nicht mit einem sevDesk-Kontakt verknüpft.');
      const list = await listOffersForContact(token, sevdeskContactId);
      setOffers(list);
      setOffersStatus('idle');
    } catch (err) {
      setOffersError(err?.message || 'Angebote konnten nicht geladen werden');
      setOffersStatus('error');
    }
  }

  function handleSelectOffer(offerId) {
    const offer = (offers || []).find((o) => String(o.id) === offerId);
    setAngebotNummer(offer?.orderNumber || '');
    setAngebotDatum(offer?.orderDate || '');
  }

  const [aiStatus, setAiStatus] = useState('idle'); // idle | running | done | error
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState('');

  function handleBrancheChange(value) {
    setBranche(value);
    setDsgvoVariante(BRANCHE_ZU_DSGVO[value] || 'standard');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('saving');
    setError('');
    try {
      const result = await createContract(objectId, {
        branche,
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
        angebotNummer: angebotNummer || null,
        angebotDatum: angebotDatum || null,
      });
      setContractId(result.contract.id);
      setWarnings(result.warnings || []);
      setStatus('done');
    } catch (err) {
      setError(err?.message || 'Vertrag konnte nicht angelegt werden');
      setStatus('error');
    }
  }

  async function handleAiReview() {
    setAiStatus('running');
    setAiError('');
    try {
      const result = await runContractAiReview(contractId);
      setAiResult(result);
      setAiStatus('done');
    } catch (err) {
      setAiError(err?.message || 'KI-Prüfung fehlgeschlagen');
      setAiStatus('error');
    }
  }

  if (status === 'done' && contractId) {
    return (
      <div className="import-box">
        <div className="modal-message success">Vertrag angelegt.</div>
        {warnings.length > 0 && (
          <div className="modal-message error">
            Entwurf unvollständig - vor Versand ergänzen:
            <ul>
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Schließen
          </button>
          {DSGVO_BRAUCHT_AVV[dsgvoVariante] && (
            <a href={avvPdfUrl(contractId)}>
              <button type="button">AVV (Anlage 3) als PDF herunterladen</button>
            </a>
          )}
          <a href={contractPdfUrl(contractId)}>
            <button type="button" className="primary">
              Als PDF herunterladen
            </button>
          </a>
        </div>

        <div className="ai-dual-checkup">
          <div className="ai-dual-header">
            <h3>KI-Gegenkontrolle (beratend)</h3>
            <button type="button" className="ai-btn-apply" onClick={handleAiReview} disabled={aiStatus === 'running'}>
              {aiStatus === 'idle' ? 'KI-Prüfung starten' : 'Erneut prüfen'}
            </button>
          </div>
          {aiStatus === 'running' && <p>Claude prüft den Vertrag gegen die Vorgaben...</p>}
          {aiStatus === 'error' && <div className="modal-message error">{aiError}</div>}
          {aiResult && (
            <div className="ai-dual-result">
              {aiResult.verstoesse?.length > 0 && (
                <div>
                  <strong>Gefundene Verstöße:</strong>
                  <ul>
                    {aiResult.verstoesse.map((v, i) => (
                      <li key={i}>
                        {v.regel} — {v.fundstelle}: {v.begruendung}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p>
                <strong>Freigabeempfehlung:</strong>{' '}
                {aiResult.freigabe === 'bereit' ? '✓ Bereit' : '⚠ Überarbeitung empfohlen'}
                {aiResult.begruendung && ` — ${aiResult.begruendung}`}
              </p>
            </div>
          )}
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
          Branche
          <select value={branche} onChange={(e) => handleBrancheChange(e.target.value)}>
            {BRANCHEN.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <label className="modal-field">
          Leistungsart
          <input value={leistungsart} onChange={(e) => setLeistungsart(e.target.value)} />
        </label>
        <label className="modal-field">
          Intervall
          <input value={reinigungsintervall} onChange={(e) => setReinigungsintervall(e.target.value)} placeholder="z.B. 2x wöchentlich" />
        </label>
      </div>
      <div className="modal-field-row">
        <label className="modal-field">
          Preis (netto, EUR/Monat)
          <input type="number" step="0.01" value={verguetungNetto} onChange={(e) => setVerguetungNetto(e.target.value)} />
        </label>
        <label className="modal-field">
          Leistungsbeginn
          <input type="date" value={vertragsbeginn} onChange={(e) => setVertragsbeginn(e.target.value)} />
        </label>
        <label className="modal-field">
          Kündigungsfrist (Monate)
          <input type="number" min="1" value={kuendigungsfristMonate} onChange={(e) => setKuendigungsfristMonate(e.target.value)} />
        </label>
      </div>
      <div className="modal-field-row">
        <label className="modal-field">
          Laufzeit (Monate, leer = unbestimmt)
          <input type="number" min="1" value={laufzeitMonate} onChange={(e) => setLaufzeitMonate(e.target.value)} />
        </label>
        <label className="modal-field">
          Zahlungsziel (Tage, leer = Standard)
          <input type="number" min="1" value={zahlungszielWerktage} onChange={(e) => setZahlungszielWerktage(e.target.value)} />
        </label>
        <label className="modal-field">
          Ansprechpartner (intern)
          <input value={internerAnsprechpartner} onChange={(e) => setInternerAnsprechpartner(e.target.value)} />
        </label>
      </div>
      <div className="modal-subheading" style={{ marginTop: 8 }}>
        Angebot (Anlage 2)
      </div>
      {offers === null && (
        <button type="button" onClick={handleLoadOffers} disabled={offersStatus === 'loading'}>
          {offersStatus === 'loading' ? 'Lädt Angebote...' : '📄 Bestehendes sevDesk-Angebot laden'}
        </button>
      )}
      {offersError && <div className="modal-message error">{offersError}</div>}
      {offers !== null && (
        <label className="modal-field">
          Angebot auswählen
          <select defaultValue="" onChange={(e) => handleSelectOffer(e.target.value)}>
            <option value="">Kein Angebot (§1.2 ohne Anlage 2)</option>
            {offers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNumber}
                {o.orderDate ? ` vom ${o.orderDate.split('-').reverse().join('.')}` : ''}
                {o.header ? ` — ${o.header}` : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      {angebotNummer && (
        <p className="modal-hint">
          Übernommen: {angebotNummer}
          {angebotDatum ? ` vom ${angebotDatum.split('-').reverse().join('.')}` : ''}
        </p>
      )}

      <div className="modal-field-row">
        <label className="modal-field">
          Datenschutz-Klausel
          <select value={dsgvoVariante} onChange={(e) => setDsgvoVariante(e.target.value)}>
            <option value="standard">Standard (Büro/Treppenhaus/Gewerbe)</option>
            <option value="physiotherapiepraxis">Physiotherapiepraxis (Art. 9 DSGVO, AVV)</option>
            <option value="arztpraxis">Arztpraxis (Art. 9 DSGVO, AVV)</option>
            <option value="psychologenpraxis">Psychologen-/Psychotherapiepraxis (Art. 9 DSGVO, AVV)</option>
          </select>
        </label>
        {BRANCHE_ZU_DSGVO[branche] !== dsgvoVariante && (
          <div className="modal-message error">
            Achtung: Diese Klausel weicht von der für "{BRANCHEN.find((b) => b.key === branche)?.label}" empfohlenen
            Variante ab.
          </div>
        )}
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

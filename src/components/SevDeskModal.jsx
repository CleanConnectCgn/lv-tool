import React, { useEffect, useRef, useState } from 'react';
import { searchContacts, createContact, createOffer, createOfferPos } from '../lib/sevdesk.js';

const TOKEN_KEY = 'lv-tool:sevdesk-token';
const ANGEBOT_KEY = 'lv-tool:last-angebotsnummer';

function nextAngebotsnummer() {
  const last = parseInt(localStorage.getItem(ANGEBOT_KEY) || '1000', 10);
  const next = last + 1;
  return { display: `AN-${next}`, value: next };
}

function addWeeks(dateStr, weeks) {
  const d = new Date(dateStr || Date.now());
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

const COLUMN_LABELS = { woechentlich: 'Wöchentlich', monatlich: 'Monatlich', jaehrlich: 'Jährlich' };

export default function SevDeskModal({ onClose, objekt, datum, sections }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [kunde, setKunde] = useState('');
  const [contactSuggestions, setContactSuggestions] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const angebotRef = useRef(nextAngebotsnummer());
  const [nettobetrag, setNettobetrag] = useState('');
  const [gueltigBis, setGueltigBis] = useState(() => addWeeks(new Date().toISOString().slice(0, 10), 6));
  const [zahlungsziel, setZahlungsziel] = useState('14');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [resultLink, setResultLink] = useState('');
  const searchTimer = useRef(null);

  useEffect(() => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
  }, [token]);

  useEffect(() => {
    if (token) return;
    fetch('/api/sevdesk/token')
      .then((r) => r.json())
      .then((data) => {
        if (data?.token) setToken(data.token);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleKundeChange(value) {
    setKunde(value);
    setSelectedContact(null);
    clearTimeout(searchTimer.current);
    if (!token || value.trim().length < 2) {
      setContactSuggestions([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await searchContacts(token, value);
        setContactSuggestions(results);
        setShowSuggestions(true);
      } catch {
        setContactSuggestions([]);
      }
    }, 300);
  }

  function pickContact(c) {
    setSelectedContact(c);
    setKunde(c.name || `${c.surename || ''} ${c.familyname || ''}`.trim());
    setShowSuggestions(false);
  }

  async function handleSubmit() {
    if (!token.trim()) {
      setStatus('error');
      setMessage('Bitte API-Token eingeben.');
      return;
    }
    if (!kunde.trim()) {
      setStatus('error');
      setMessage('Bitte Kundenname eingeben.');
      return;
    }
    setStatus('loading');
    setMessage('');
    try {
      let contactId = selectedContact?.id;
      if (!contactId) {
        const created = await createContact(token, kunde.trim());
        contactId = created?.id;
      }
      if (!contactId) throw new Error('Kunde konnte nicht ermittelt/erstellt werden.');

      const { display: offerNumber } = angebotRef.current;
      const header = `Angebot Leistungsverzeichnis – ${objekt || 'Objekt'}`;
      const headText = `Sehr geehrte Damen und Herren,\n\nwir bieten Ihnen die Reinigungsleistungen gemäß beiliegendem Leistungsverzeichnis für "${objekt || 'Objekt'}" an.\n\nGültig bis: ${gueltigBis}\nZahlungsziel: ${zahlungsziel} Tage`;
      const footText = 'Wir freuen uns auf Ihre Beauftragung.\n\nClean Connect Gebäudereinigung';

      const offer = await createOffer(token, { contactId, header, headText, footText, offerNumber });
      const offerId = offer?.id;
      if (!offerId) throw new Error('Angebot konnte nicht erstellt werden.');

      let positionNumber = 0;
      for (const section of sections) {
        positionNumber += 1;
        await createOfferPos(token, {
          offerId,
          name: section.title,
          text: '',
          quantity: 0,
          price: 0,
          isTitle: true,
          positionNumber,
        });
        for (const row of section.rows) {
          if (!row.text.trim()) continue;
          positionNumber += 1;
          const intervalText = row.bedarf
            ? 'Bei Bedarf'
            : row.intervalColumn
            ? `${COLUMN_LABELS[row.intervalColumn]}: ${row.intervalValue}`
            : '';
          const descParts = [intervalText, row.bemerkung].filter(Boolean);
          await createOfferPos(token, {
            offerId,
            name: row.text,
            text: descParts.join(' – '),
            quantity: 1,
            price: nettobetrag ? Number(nettobetrag) / countRows(sections) : 0,
            positionNumber,
          });
        }
      }

      localStorage.setItem(ANGEBOT_KEY, String(angebotRef.current.value));
      setStatus('success');
      setResultLink(`https://my.sevdesk.de/om/detail/type/AN/id/${offerId}`);
      setMessage(`Angebot ${offerNumber} erfolgreich in sevDesk erstellt.`);
    } catch (err) {
      setStatus('error');
      setMessage(err.message || String(err));
    }
  }

  function countRows(secs) {
    const n = secs.reduce((sum, s) => sum + s.rows.filter((r) => r.text.trim()).length, 0);
    return n || 1;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal sevdesk-modal" onClick={(e) => e.stopPropagation()}>
        <h2>An sevDesk senden</h2>
        <p className="modal-hint">Erstellt ein Angebot in sevDesk mit allen Positionen aus diesem LV.</p>

        <label className="modal-field">
          sevDesk API-Token
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="API-Token einfügen"
          />
        </label>

        <label className="modal-field autocomplete-wrap">
          Kundenname
          <input
            type="text"
            value={kunde}
            onChange={(e) => handleKundeChange(e.target.value)}
            onFocus={() => setShowSuggestions(contactSuggestions.length > 0)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Kunde suchen oder neu anlegen"
          />
          {showSuggestions && contactSuggestions.length > 0 && (
            <ul className="autocomplete-list">
              {contactSuggestions.map((c) => (
                <li key={c.id} onMouseDown={() => pickContact(c)}>
                  {c.name || `${c.surename || ''} ${c.familyname || ''}`.trim()}
                </li>
              ))}
            </ul>
          )}
        </label>

        <label className="modal-field">
          Angebotsnummer
          <input type="text" value={angebotRef.current.display} readOnly />
        </label>

        <label className="modal-field">
          Nettobetrag (€)
          <input
            type="number"
            value={nettobetrag}
            onChange={(e) => setNettobetrag(e.target.value)}
            placeholder="0.00"
          />
        </label>

        <div className="modal-field-row">
          <label className="modal-field">
            Gültig bis
            <input type="date" value={gueltigBis} onChange={(e) => setGueltigBis(e.target.value)} />
          </label>
          <label className="modal-field">
            Zahlungsziel (Tage)
            <input
              type="number"
              value={zahlungsziel}
              onChange={(e) => setZahlungsziel(e.target.value)}
            />
          </label>
        </div>

        {message && (
          <div className={`modal-message ${status}`}>
            {message}
            {resultLink && (
              <>
                {' '}
                <a href={resultLink} target="_blank" rel="noreferrer">
                  Angebot öffnen
                </a>
              </>
            )}
          </div>
        )}

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

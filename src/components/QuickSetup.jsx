import React, { useEffect, useRef, useState } from 'react';
import { searchContacts, createContact, getContactAddress } from '../lib/sevdesk.js';
import { AREA_DEFINITIONS, AREA_ORDER, buildSectionsFromSetup } from '../templates/checklistAreas.js';

const TOKEN_KEY = 'lv-tool:sevdesk-token';
const FREQUENCIES = ['1x', '2x', '3x', '4x', '5x', '6x', '7x'];
const LAMELLEN_FREQUENCIES = Array.from({ length: 12 }, (_, i) => `${i + 1}x`);

function addressLine(addr) {
  if (!addr) return '';
  return [addr.street, [addr.zip, addr.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

export default function QuickSetup({ onGenerate, onCancel }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');

  // Kundendaten
  const [kunde, setKunde] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [showNewContact, setShowNewContact] = useState(false);
  const [ncFirma, setNcFirma] = useState('');
  const [ncStrasse, setNcStrasse] = useState('');
  const [ncPlz, setNcPlz] = useState('');
  const [ncStadt, setNcStadt] = useState('');
  const [ncEmail, setNcEmail] = useState('');
  const searchTimer = useRef(null);

  // Schritt 1-3
  const [frequency, setFrequency] = useState('2x');
  const [areas, setAreas] = useState(() =>
    Object.fromEntries(AREA_ORDER.map((k) => [k, false]))
  );
  const [glasEnabled, setGlasEnabled] = useState(false);
  const [rahmen, setRahmen] = useState(false);
  const [lamellen, setLamellen] = useState(false);
  const [lamellenFreq, setLamellenFreq] = useState('1x');
  const [grundreinigung, setGrundreinigung] = useState(false);
  const [winterdienst, setWinterdienst] = useState(false);
  const [hausmeisterservice, setHausmeisterservice] = useState(false);
  const [erstreinigung, setErstreinigung] = useState(false);
  const [erstreinigungStunden, setErstreinigungStunden] = useState('');

  useEffect(() => {
    if (token) return;
    fetch('/api/sevdesk/token')
      .then((r) => r.json())
      .then((data) => {
        if (data?.token) setToken(data.token);
      })
      .catch(() => {});
  }, [token]);

  function handleKundeChange(value) {
    setKunde(value);
    setSelectedContact(null);
    setSelectedAddress(null);
    clearTimeout(searchTimer.current);
    if (!token || value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await searchContacts(token, value);
        setSuggestions(results);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  }

  function pickContact(c) {
    setSelectedContact(c);
    setKunde(c.name);
    setShowSuggestions(false);
    setShowNewContact(false);
    if (token) {
      getContactAddress(token, c.id).then(setSelectedAddress).catch(() => {});
    }
  }

  function toggleArea(key) {
    setAreas((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleGenerate() {
    const sections = buildSectionsFromSetup({
      frequency,
      areas,
      glas: { enabled: glasEnabled, rahmen, lamellen, lamellenFreq },
      grundreinigung,
      winterdienst,
      hausmeisterservice,
      erstreinigung: { enabled: erstreinigung, stunden: erstreinigungStunden },
    });

    let customer = null;
    if (showNewContact && ncFirma.trim()) {
      if (token) {
        try {
          const created = await createContact(token, {
            name: ncFirma.trim(),
            street: ncStrasse.trim(),
            zip: ncPlz.trim(),
            city: ncStadt.trim(),
            email: ncEmail.trim(),
          });
          customer = {
            id: created?.id,
            name: ncFirma.trim(),
            street: ncStrasse.trim(),
            zip: ncPlz.trim(),
            city: ncStadt.trim(),
          };
        } catch {
          customer = { name: ncFirma.trim(), street: ncStrasse.trim(), zip: ncPlz.trim(), city: ncStadt.trim() };
        }
      } else {
        customer = { name: ncFirma.trim(), street: ncStrasse.trim(), zip: ncPlz.trim(), city: ncStadt.trim() };
      }
    } else if (selectedContact) {
      customer = {
        id: selectedContact.id,
        name: selectedContact.name,
        street: selectedAddress?.street || '',
        zip: selectedAddress?.zip || '',
        city: selectedAddress?.city || '',
      };
    }

    onGenerate({ sections, customer });
  }

  return (
    <div className="overview-page">
      <div className="overview-page-card quick-setup-card">
        <h2>Neues Leistungsverzeichnis</h2>
        <p className="modal-hint">
          Kundendaten und Grundeinstellungen festlegen, dann das Leistungsverzeichnis generieren.
        </p>

        <div className="modal-subheading">Kundendaten</div>
        {!showNewContact && (
          <label className="modal-field autocomplete-wrap">
            Kundenname / Firma
            <input
              type="text"
              value={kunde}
              onChange={(e) => handleKundeChange(e.target.value)}
              onFocus={() => setShowSuggestions(suggestions.length > 0)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Kunde suchen (sevDesk-Erkennung)"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="autocomplete-list">
                {suggestions.map((c) => (
                  <li key={c.id} onMouseDown={() => pickContact(c)}>
                    {c.city ? `${c.name}, ${c.city}` : c.name}
                  </li>
                ))}
              </ul>
            )}
          </label>
        )}
        {!showNewContact && selectedContact && (
          <div className="modal-hint contact-address-preview">
            {selectedAddress ? addressLine(selectedAddress) || 'Keine Adresse hinterlegt' : 'Lädt Adresse...'}
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            setShowNewContact((v) => {
              const next = !v;
              if (next && !ncFirma.trim() && kunde.trim()) setNcFirma(kunde.trim());
              return next;
            });
          }}
          style={{ marginBottom: 12 }}
        >
          {showNewContact ? 'Bestehenden Kunden suchen' : 'Neuer Kunde'}
        </button>
        {showNewContact && (
          <>
            <label className="modal-field">
              Firmenname
              <input type="text" value={ncFirma} onChange={(e) => setNcFirma(e.target.value)} />
            </label>
            <label className="modal-field">
              Straße
              <input type="text" value={ncStrasse} onChange={(e) => setNcStrasse(e.target.value)} />
            </label>
            <div className="modal-field-row">
              <label className="modal-field">
                PLZ
                <input type="text" value={ncPlz} onChange={(e) => setNcPlz(e.target.value)} />
              </label>
              <label className="modal-field">
                Stadt
                <input type="text" value={ncStadt} onChange={(e) => setNcStadt(e.target.value)} />
              </label>
            </div>
            <label className="modal-field">
              E-Mail
              <input type="email" value={ncEmail} onChange={(e) => setNcEmail(e.target.value)} />
            </label>
          </>
        )}

        <hr className="modal-section-divider" />
        <div className="modal-subheading">Schritt 1 — Reinigungsfrequenz</div>
        <label className="modal-field">
          Wie oft pro Woche?
          <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>

        <hr className="modal-section-divider" />
        <div className="modal-subheading">Schritt 2 — Bereiche auswählen</div>
        <div className="quick-setup-static-item">Unterhaltsreinigung — immer aktiv</div>
        <div className="quick-setup-checkbox-list">
          {AREA_ORDER.map((key) => (
            <label key={key} className="quick-setup-checkbox">
              <input type="checkbox" checked={areas[key]} onChange={() => toggleArea(key)} />
              {AREA_DEFINITIONS[key].label}
            </label>
          ))}
        </div>

        <hr className="modal-section-divider" />
        <div className="modal-subheading">Schritt 3 — Zusatzleistungen</div>
        <div className="quick-setup-checkbox-list">
          <label className="quick-setup-checkbox">
            <input type="checkbox" checked={glasEnabled} onChange={(e) => setGlasEnabled(e.target.checked)} />
            Glasreinigung
          </label>
          {glasEnabled && (
            <div className="quick-setup-suboptions">
              <label className="quick-setup-checkbox">
                <input type="checkbox" checked={rahmen} onChange={(e) => setRahmen(e.target.checked)} />
                Rahmenreinigung inklusive
              </label>
              <label className="quick-setup-checkbox">
                <input type="checkbox" checked={lamellen} onChange={(e) => setLamellen(e.target.checked)} />
                Lamellenreinigung inklusive
              </label>
              {lamellen && (
                <label className="modal-field quick-setup-sub-field">
                  Häufigkeit (jährlich)
                  <select value={lamellenFreq} onChange={(e) => setLamellenFreq(e.target.value)}>
                    {LAMELLEN_FREQUENCIES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
          <label className="quick-setup-checkbox">
            <input
              type="checkbox"
              checked={grundreinigung}
              onChange={(e) => setGrundreinigung(e.target.checked)}
            />
            Grundreinigung (einmalig, 50% Rabatt)
          </label>
          <label className="quick-setup-checkbox">
            <input type="checkbox" checked={winterdienst} onChange={(e) => setWinterdienst(e.target.checked)} />
            Winterdienst
          </label>
          <label className="quick-setup-checkbox">
            <input
              type="checkbox"
              checked={hausmeisterservice}
              onChange={(e) => setHausmeisterservice(e.target.checked)}
            />
            Hausmeisterservice
          </label>
          <label className="quick-setup-checkbox">
            <input type="checkbox" checked={erstreinigung} onChange={(e) => setErstreinigung(e.target.checked)} />
            Erstreinigung (Stunden × 32 EUR)
          </label>
          {erstreinigung && (
            <label className="modal-field quick-setup-sub-field">
              Stunden
              <input
                type="number"
                value={erstreinigungStunden}
                onChange={(e) => setErstreinigungStunden(e.target.value)}
                placeholder="0"
              />
            </label>
          )}
        </div>

        <div className="modal-actions">
          <button onClick={onCancel}>Abbrechen</button>
          <button className="primary" onClick={handleGenerate}>
            Leistungsverzeichnis generieren
          </button>
        </div>
      </div>
    </div>
  );
}

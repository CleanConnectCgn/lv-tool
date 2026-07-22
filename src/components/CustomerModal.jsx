import React, { useEffect, useRef, useState } from 'react';
import { searchContacts, createContact, getContactAddress } from '../lib/sevdesk.js';

const TOKEN_KEY = 'lv-tool:sevdesk-token';

function addressLine(addr) {
  if (!addr) return '';
  return [addr.street, [addr.zip, addr.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

export default function CustomerModal({ initialCustomer, onSave, onClose }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');

  useEffect(() => {
    if (token) return;
    fetch('/api/sevdesk/token')
      .then((r) => r.json())
      .then((data) => {
        if (data?.token) setToken(data.token);
      })
      .catch(() => {});
  }, [token]);
  const [kunde, setKunde] = useState(initialCustomer?.name || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedContact, setSelectedContact] = useState(
    initialCustomer?.id ? { id: initialCustomer.id, name: initialCustomer.name } : null
  );
  const [selectedAddress, setSelectedAddress] = useState(
    initialCustomer?.id
      ? { street: initialCustomer.street, zip: initialCustomer.zip, city: initialCustomer.city }
      : null
  );
  const [showNewContact, setShowNewContact] = useState(false);
  const [ncFirma, setNcFirma] = useState('');
  const [ncStrasse, setNcStrasse] = useState('');
  const [ncPlz, setNcPlz] = useState('');
  const [ncStadt, setNcStadt] = useState('');
  const [ncEmail, setNcEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const searchTimer = useRef(null);

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

  async function handleSave() {
    setSaving(true);
    try {
      if (showNewContact && ncFirma.trim()) {
        let customer = { name: ncFirma.trim(), street: ncStrasse.trim(), zip: ncPlz.trim(), city: ncStadt.trim() };
        if (token) {
          try {
            const created = await createContact(token, {
              name: ncFirma.trim(),
              street: ncStrasse.trim(),
              zip: ncPlz.trim(),
              city: ncStadt.trim(),
              email: ncEmail.trim(),
            });
            customer = { ...customer, id: created?.id };
          } catch {
            // fall back to unlinked customer data
          }
        }
        onSave(customer);
      } else if (selectedContact) {
        onSave({
          id: selectedContact.id,
          name: selectedContact.name,
          street: selectedAddress?.street || '',
          zip: selectedAddress?.zip || '',
          city: selectedAddress?.city || '',
        });
      } else {
        onSave(null);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Kunde</h2>
        <p className="modal-hint">Mit sevDesk verknüpften Kunden auswählen oder neu anlegen.</p>

        {!showNewContact && (
          <label className="modal-field autocomplete-wrap">
            Kundenname / Firma
            <input
              type="text"
              value={kunde}
              onChange={(e) => handleKundeChange(e.target.value)}
              onFocus={() => setShowSuggestions(suggestions.length > 0)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Kunde suchen"
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

        <div className="modal-actions">
          <button onClick={onClose}>Abbrechen</button>
          <button className="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Speichert...' : 'Übernehmen'}
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { createDbCustomer } from '../../lib/dbCrm.js';

// "Rechnungsadresse gleich Objektadresse": der Haken kopiert NUR die
// Adresse - ein Objekt wird in jedem Fall angelegt (server/lib/dbCrm.js
// erzwingt das zusätzlich per Transaktion), egal ob der Haken gesetzt ist.
export default function DbCustomerForm({ onBack, onCreated }) {
  const [name, setName] = useState('');
  const [street, setStreet] = useState('');
  const [zip, setZip] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [paymentTermDays, setPaymentTermDays] = useState('');

  const [sameAsObjectAddress, setSameAsObjectAddress] = useState(true);
  const [objStreet, setObjStreet] = useState('');
  const [objZip, setObjZip] = useState('');
  const [objCity, setObjCity] = useState('');
  const [objLabel, setObjLabel] = useState('');
  const [objContactPerson, setObjContactPerson] = useState('');
  const [objAccessNote, setObjAccessNote] = useState('');

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Firmenname ist erforderlich.');
      return;
    }
    setSaving(true);
    try {
      const result = await createDbCustomer({
        name,
        street,
        zip,
        city,
        email,
        contactPerson,
        paymentTermDays: paymentTermDays || null,
        sameAsObjectAddress,
        firstObject: sameAsObjectAddress
          ? undefined
          : {
              street: objStreet,
              zip: objZip,
              city: objCity,
              label: objLabel,
              contactPersonOnSite: objContactPerson,
              accessNote: objAccessNote,
            },
      });
      onCreated(result.customer.id);
    } catch (err) {
      setError(err?.message || 'Kunde konnte nicht angelegt werden');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overview-page">
      <form className="overview-page-card" onSubmit={handleSubmit}>
        <h2>Neuer Kunde</h2>

        {error && <div className="modal-message error">{error}</div>}

        <div className="modal-subheading">Stammdaten</div>
        <label className="modal-field">
          Firmenname
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <div className="modal-field-row">
          <label className="modal-field">
            Ansprechpartner
            <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          </label>
          <label className="modal-field">
            E-Mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="modal-field">
            Zahlungsziel (Tage)
            <input type="number" value={paymentTermDays} onChange={(e) => setPaymentTermDays(e.target.value)} />
          </label>
        </div>

        <hr className="modal-section-divider" />
        <div className="modal-subheading">Rechnungsadresse</div>
        <label className="modal-field">
          Straße
          <input value={street} onChange={(e) => setStreet(e.target.value)} />
        </label>
        <div className="modal-field-row">
          <label className="modal-field">
            PLZ
            <input value={zip} onChange={(e) => setZip(e.target.value)} />
          </label>
          <label className="modal-field">
            Ort
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
        </div>

        <hr className="modal-section-divider" />
        <div className="modal-subheading">Objekt (mindestens eines wird immer angelegt)</div>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={sameAsObjectAddress}
            onChange={(e) => setSameAsObjectAddress(e.target.checked)}
          />
          Rechnungsadresse gleich Objektadresse
        </label>

        {!sameAsObjectAddress && (
          <div style={{ marginTop: 12 }}>
            <label className="modal-field">
              Objekt-Straße
              <input value={objStreet} onChange={(e) => setObjStreet(e.target.value)} required />
            </label>
            <div className="modal-field-row">
              <label className="modal-field">
                PLZ
                <input value={objZip} onChange={(e) => setObjZip(e.target.value)} required />
              </label>
              <label className="modal-field">
                Ort
                <input value={objCity} onChange={(e) => setObjCity(e.target.value)} required />
              </label>
            </div>
            <label className="modal-field">
              Kurzname (optional, sonst Straße)
              <input value={objLabel} onChange={(e) => setObjLabel(e.target.value)} />
            </label>
            <div className="modal-field-row">
              <label className="modal-field">
                Ansprechpartner vor Ort
                <input value={objContactPerson} onChange={(e) => setObjContactPerson(e.target.value)} />
              </label>
              <label className="modal-field">
                Zugangsnotiz
                <input value={objAccessNote} onChange={(e) => setObjAccessNote(e.target.value)} />
              </label>
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onBack}>
            Abbrechen
          </button>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? 'Speichert...' : 'Kunde anlegen'}
          </button>
        </div>
      </form>
    </div>
  );
}

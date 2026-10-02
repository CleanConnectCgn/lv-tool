import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  searchContacts,
  getContactAddress,
  getNextOfferNumber,
  listSevUsers,
  createWinterdienstOffer,
} from '../lib/sevdesk.js';
import {
  AUFTRAGGEBER_ARTEN,
  DEFAULT_FLAECHE,
  DEFAULT_DECKUNGSSUMME,
  buildWinterdienstOffer,
  saisonMonate,
} from '../templates/winterdienstOffer.js';

// Winterdienst-Angebot, das der Kunde direkt unterschreibt (Vorlage aus
// AN-1363/AN-1364). Unabhängig vom LV-Editor: ein Winterdienst braucht kein
// Leistungsverzeichnis, nur Kunde, Objekt, Fläche und drei Preise. Legt das
// Angebot als Entwurf in sevDesk an - verschickt wird aus sevDesk.

const DEFAULT_SEV_USER = { id: '1361306', fullname: 'Julian Mühlhoff' };
const TOKEN_KEY = 'lv-tool:sevdesk-token';

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Nächste Saison: ab Oktober bzw. im laufenden Winter (bis März) die Saison,
// die im November dieses bzw. letzten Jahres beginnt.
function defaultSaison(todayIso) {
  const [y, m] = todayIso.split('-').map(Number);
  const startYear = m <= 3 ? y - 1 : y;
  return { start: `${startYear}-11-01`, ende: `${startYear + 1}-03-31` };
}

function eur(n) {
  return (Number(n) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function WinterdienstOfferModal({ onClose }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [tokenFromServer, setTokenFromServer] = useState(false);

  const [kunde, setKunde] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [contact, setContact] = useState(null);
  const [contactAddress, setContactAddress] = useState(null);
  const searchTimer = useRef(null);

  const [offerNumber, setOfferNumber] = useState('');
  const [sevUsers, setSevUsers] = useState([DEFAULT_SEV_USER]);
  const [contactPersonId, setContactPersonId] = useState(DEFAULT_SEV_USER.id);

  const [art, setArt] = useState('weg');
  const [objektStrasse, setObjektStrasse] = useState('');
  const [objektPlz, setObjektPlz] = useState('');
  const [objektOrt, setObjektOrt] = useState('');
  const [auftraggeberEigen, setAuftraggeberEigen] = useState('');
  const [vertreten, setVertreten] = useState(true);
  const [flaeche, setFlaeche] = useState(DEFAULT_FLAECHE);
  const [bereitschaft, setBereitschaft] = useState('');
  const [streuen, setStreuen] = useState('');
  const [raeumen, setRaeumen] = useState('');
  const [zuschlag, setZuschlag] = useState('100');
  const [deckungssumme, setDeckungssumme] = useState(DEFAULT_DECKUNGSSUMME);
  const [widerruf, setWiderruf] = useState(true);

  const today = isoToday();
  const saisonDefault = defaultSaison(today);
  const [offerDate, setOfferDate] = useState(today);
  const [gueltigBis, setGueltigBis] = useState(addDays(today, 21));
  const [saisonStart, setSaisonStart] = useState(saisonDefault.start);
  const [saisonEnde, setSaisonEnde] = useState(saisonDefault.ende);

  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [offerId, setOfferId] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (token && !tokenFromServer) localStorage.setItem(TOKEN_KEY, token);
  }, [token, tokenFromServer]);

  useEffect(() => {
    if (token) return;
    fetch('/api/sevdesk/token')
      .then((r) => r.json())
      .then((data) => {
        if (data?.token) {
          setToken(data.token);
          setTokenFromServer(true);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getNextOfferNumber(token)
      .then((n) => !cancelled && n && setOfferNumber(n))
      .catch(() => {});
    listSevUsers(token)
      .then((users) => !cancelled && users?.length && setSevUsers(users))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  function handleKundeChange(value) {
    setKunde(value);
    setContact(null);
    setContactAddress(null);
    clearTimeout(searchTimer.current);
    if (!token || value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        setSuggestions(await searchContacts(token, value));
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  }

  function pickContact(c) {
    setContact(c);
    setKunde(c.name);
    setShowSuggestions(false);
    getContactAddress(token, c.id).then(setContactAddress).catch(() => {});
  }

  function changeArt(key) {
    setArt(key);
    setWiderruf(AUFTRAGGEBER_ARTEN[key].widerruf);
    setVertreten(key === 'weg');
  }

  const objekt = [objektStrasse.trim(), [objektPlz.trim(), objektOrt.trim()].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
  const auftraggeber =
    art === 'weg'
      ? `Gemeinschaft der Wohnungseigentümer ${objekt}`
      : art === 'firma' && !auftraggeberEigen.trim()
        ? contact?.name || ''
        : auftraggeberEigen.trim();
  const kontaktZipCity = [contactAddress?.zip, contactAddress?.city].filter(Boolean).join(' ');
  const vertreter =
    vertreten && contact ? { name: contact.name, street: contactAddress?.street || '', zipCity: kontaktZipCity } : null;
  const monate = saisonMonate(saisonStart, saisonEnde);

  const input = useMemo(
    () => ({
      offerNumber,
      offerDate,
      gueltigBis,
      saisonStart,
      saisonEnde,
      objekt,
      stadt: objektOrt.trim(),
      art,
      auftraggeber,
      vertreter,
      rechnungsanschrift: contact ? { street: contactAddress?.street || '', zipCity: kontaktZipCity } : null,
      flaeche,
      preise: { bereitschaft, streuen, raeumen },
      zuschlagProzent: Number(zuschlag) || 0,
      deckungssumme,
      widerruf,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [offerNumber, offerDate, gueltigBis, saisonStart, saisonEnde, objekt, objektOrt, art, auftraggeber,
      vertreter?.name, vertreter?.street, vertreter?.zipCity, contact, contactAddress, flaeche,
      bereitschaft, streuen, raeumen, zuschlag, deckungssumme, widerruf]
  );

  function validate() {
    if (!token.trim()) return 'Bitte sevDesk-Token eingeben.';
    if (!contact) return 'Bitte den sevDesk-Kunden (Rechnungsempfänger / Verwaltung) auswählen.';
    if (!offerNumber) return 'Angebotsnummer konnte nicht von sevDesk geladen werden.';
    if (!objektStrasse.trim() || !objektPlz.trim() || !objektOrt.trim()) return 'Bitte Objektadresse vollständig eintragen.';
    if (!auftraggeber.trim()) return 'Bitte den Auftraggeber eintragen.';
    if (!(Number(bereitschaft) > 0) || !(Number(streuen) > 0) || !(Number(raeumen) > 0)) {
      return 'Bitte alle drei Preise eintragen.';
    }
    if (monate < 1) return 'Saisonende liegt vor dem Saisonbeginn.';
    if (gueltigBis < offerDate) return '"Gültig bis" liegt vor dem Angebotsdatum.';
    return null;
  }

  async function handleSubmit() {
    const fehler = validate();
    if (fehler) {
      setStatus('error');
      setMessage(fehler);
      return;
    }
    setStatus('loading');
    setMessage('');
    try {
      const built = buildWinterdienstOffer(input);
      const order = await createWinterdienstOffer(token, {
        contactId: contact.id,
        contactPersonId,
        offerNumber,
        offerDate,
        built,
      });
      if (!order?.id) throw new Error('Angebot konnte nicht erstellt werden.');
      setOfferId(order.id);
      setStatus('success');
      setMessage(`Angebot ${offerNumber} als Entwurf in sevDesk angelegt.`);
    } catch (err) {
      setStatus('error');
      setMessage(err?.message || String(err));
    }
  }

  async function handleDownloadPdf() {
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/sevdesk/offer-pdf/${offerId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `PDF nicht verfügbar (${res.status})`);
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `Angebot_${offerNumber}_Winterdienst_${objektStrasse.replace(/[^a-zA-Z0-9äöüÄÖÜß]+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMessage(err?.message || String(err));
    } finally {
      setPdfLoading(false);
    }
  }

  const resultLink = offerId ? `https://my.sevdesk.de/om/detail/type/AN/id/${offerId}` : '';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal sevdesk-modal" onClick={(e) => e.stopPropagation()}>
        <h2>❄️ Winterdienst-Angebot</h2>
        <p className="modal-hint">
          Angebot zum direkten Unterschreiben: Leistungsbeschreibung, Vertragsbedingungen, Auftragserteilung
          und (bei Eigentümern/WEG) Widerrufsbelehrung, jeweils auf eigener Seite. Wird als Entwurf in sevDesk
          angelegt und von dort verschickt.
        </p>

        {status === 'success' ? (
          <div className="modal-message success">
            <div className="offer-number-display">{offerNumber}</div>
            {message}
            <div className="offer-success-actions">
              <button type="button" onClick={handleDownloadPdf} disabled={pdfLoading}>
                {pdfLoading ? 'Lädt...' : 'PDF herunterladen'}
              </button>
              <a href={resultLink} target="_blank" rel="noreferrer">
                In sevDesk öffnen
              </a>
            </div>
          </div>
        ) : (
          <>
            <label className="modal-field">
              sevDesk API Token
              {tokenFromServer ? (
                <div className="token-badge">✓ Server Token aktiv</div>
              ) : (
                <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="API Token einfügen" />
              )}
            </label>

            <div className="modal-subheading">Kunde in sevDesk (Rechnungsempfänger)</div>
            <label className="modal-field autocomplete-wrap">
              Hausverwaltung / Firma / Eigentümer
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
            {contact && (
              <div className="modal-hint contact-address-preview">
                {contactAddress
                  ? [contactAddress.street, kontaktZipCity].filter(Boolean).join(', ') || 'Keine Adresse hinterlegt'
                  : 'Lädt Adresse...'}
              </div>
            )}

            <div className="modal-subheading">Objekt</div>
            <label className="modal-field">
              Straße und Hausnummer
              <input type="text" value={objektStrasse} onChange={(e) => setObjektStrasse(e.target.value)} />
            </label>
            <div className="modal-field-row">
              <label className="modal-field">
                PLZ
                <input type="text" value={objektPlz} onChange={(e) => setObjektPlz(e.target.value)} />
              </label>
              <label className="modal-field">
                Ort (Stadt, nicht Stadtteil)
                <input type="text" value={objektOrt} onChange={(e) => setObjektOrt(e.target.value)} />
              </label>
            </div>

            <div className="modal-subheading">Auftraggeber</div>
            <div className="quick-setup-typ-list">
              {Object.entries(AUFTRAGGEBER_ARTEN).map(([key, v]) => (
                <button
                  key={key}
                  type="button"
                  className={`quick-setup-typ-btn${art === key ? ' active' : ''}`}
                  onClick={() => changeArt(key)}
                >
                  {v.label}
                </button>
              ))}
            </div>
            {art !== 'weg' && (
              <label className="modal-field">
                Name des Auftraggebers
                <input
                  type="text"
                  value={auftraggeberEigen}
                  onChange={(e) => setAuftraggeberEigen(e.target.value)}
                  placeholder={art === 'firma' ? contact?.name || 'Firmenname' : 'z. B. Herr Max Mustermann'}
                />
              </label>
            )}
            <label className="modal-field modal-field-checkbox">
              <input type="checkbox" checked={vertreten} onChange={(e) => setVertreten(e.target.checked)} />
              Wird vertreten durch den sevDesk-Kunden (Hausverwaltung)
            </label>
            <p className="modal-hint">
              Im Angebot steht: <b>{auftraggeber || '…'}</b>
              {vertreter ? `, vertreten durch ${vertreter.name}` : ''}
            </p>

            <div className="modal-subheading">Vertragsfläche</div>
            <label className="modal-field">
              Beschreibung ({'{objekt}'} und {'{stadt}'} werden ersetzt)
              <textarea rows={3} value={flaeche} onChange={(e) => setFlaeche(e.target.value)} />
            </label>

            <div className="modal-subheading">Saison und Fristen</div>
            <div className="modal-field-row">
              <label className="modal-field">
                Saisonbeginn
                <input type="date" value={saisonStart} onChange={(e) => setSaisonStart(e.target.value)} />
              </label>
              <label className="modal-field">
                Saisonende
                <input type="date" value={saisonEnde} onChange={(e) => setSaisonEnde(e.target.value)} />
              </label>
            </div>
            <div className="modal-field-row">
              <label className="modal-field">
                Angebotsdatum
                <input type="date" value={offerDate} onChange={(e) => setOfferDate(e.target.value)} />
              </label>
              <label className="modal-field">
                Gültig bis
                <input type="date" value={gueltigBis} onChange={(e) => setGueltigBis(e.target.value)} />
              </label>
            </div>

            <div className="modal-subheading">Preise (netto)</div>
            <div className="modal-field-row">
              <label className="modal-field">
                Bereitschaft je Monat (€)
                <input type="number" step="0.01" value={bereitschaft} onChange={(e) => setBereitschaft(e.target.value)} />
              </label>
              <label className="modal-field">
                Streuen je Einsatz (€)
                <input type="number" step="0.01" value={streuen} onChange={(e) => setStreuen(e.target.value)} />
              </label>
            </div>
            <div className="modal-field-row">
              <label className="modal-field">
                Räumen &amp; Streuen je Einsatz (€)
                <input type="number" step="0.01" value={raeumen} onChange={(e) => setRaeumen(e.target.value)} />
              </label>
              <label className="modal-field">
                Sonn-/Feiertagszuschlag (%)
                <input type="number" value={zuschlag} onChange={(e) => setZuschlag(e.target.value)} />
              </label>
            </div>
            <div className="modal-field-row">
              <label className="modal-field">
                Haftpflicht-Deckungssumme mindestens (€)
                <input type="text" value={deckungssumme} onChange={(e) => setDeckungssumme(e.target.value)} />
              </label>
            </div>
            <div className="price-summary-total">
              Feste Saisonkosten: {monate} × {eur(bereitschaft)} € = {eur(monate * (Number(bereitschaft) || 0))} € netto
            </div>

            <label className="modal-field modal-field-checkbox">
              <input type="checkbox" checked={widerruf} onChange={(e) => setWiderruf(e.target.checked)} />
              Widerrufsbelehrung beilegen (Pflicht bei Privat-Eigentümern und WEG)
            </label>

            <div className="modal-subheading">Angebot</div>
            <div className="modal-field-row">
              <label className="modal-field">
                Angebotsnummer
                <input type="text" value={offerNumber || 'Lädt...'} readOnly />
              </label>
              <label className="modal-field">
                Ihr Ansprechpartner
                <select value={contactPersonId} onChange={(e) => setContactPersonId(e.target.value)}>
                  {sevUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullname}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {message && <div className={`modal-message ${status}`}>{message}</div>}
          </>
        )}

        <div className="modal-actions">
          <button onClick={onClose}>{status === 'success' ? 'Schließen' : 'Abbrechen'}</button>
          {status !== 'success' && (
            <button className="primary" onClick={handleSubmit} disabled={status === 'loading'}>
              {status === 'loading' ? 'Lege an...' : 'Angebot in sevDesk anlegen'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

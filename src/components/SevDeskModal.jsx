import React, { useEffect, useRef, useState } from 'react';
import { searchContacts, createContact, createOffer, getNextOfferNumber } from '../lib/sevdesk.js';

const TOKEN_KEY = 'lv-tool:sevdesk-token';

function addWeeks(dateStr, weeks) {
  const d = new Date(dateStr || Date.now());
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

function formatDateDE(isoStr) {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-');
  return `${d}.${m}.${y}`;
}

function isGlasSection(title) {
  const t = (title || '').toLowerCase();
  return t.includes('glas') || t.includes('lamell');
}

const COLUMN_LABELS = { woechentlich: 'Wöchentlich', monatlich: 'Monatlich', jaehrlich: 'Jährlich' };

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function salutationForContact(c) {
  if (c?.gender === 'm' && c.familyname) return `Sehr geehrter Herr ${c.familyname},`;
  if (c?.gender === 'w' && c.familyname) return `Sehr geehrte Frau ${c.familyname},`;
  return 'Sehr geehrte Damen und Herren,';
}

export default function SevDeskModal({ onClose, objekt, datum, intervallInfo, sections, lvTypeLabel }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [tokenFromServer, setTokenFromServer] = useState(false);

  const [kunde, setKunde] = useState('');
  const [contactSuggestions, setContactSuggestions] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimer = useRef(null);

  const [showNewContact, setShowNewContact] = useState(false);
  const [ncFirma, setNcFirma] = useState('');
  const [ncAnsprechpartner, setNcAnsprechpartner] = useState('Julian Mühlhoff');
  const [ncStrasse, setNcStrasse] = useState('');
  const [ncPlz, setNcPlz] = useState('');
  const [ncStadt, setNcStadt] = useState('');
  const [ncEmail, setNcEmail] = useState('');

  const [offerNumber, setOfferNumber] = useState('');
  const [offerNumberLoading, setOfferNumberLoading] = useState(false);
  const [ansprechpartner, setAnsprechpartner] = useState('Julian Mühlhoff');
  const [leistungsbeginn, setLeistungsbeginn] = useState(() => new Date().toISOString().slice(0, 10));
  const [gueltigBis, setGueltigBis] = useState(() => addWeeks(new Date().toISOString().slice(0, 10), 6));
  const [zahlungsziel, setZahlungsziel] = useState('14');
  const [nettobetragUHR, setNettobetragUHR] = useState('');
  const [nettobetragGlas, setNettobetragGlas] = useState('');

  const [showTexts, setShowTexts] = useState(false);
  const [anrede, setAnrede] = useState('Sehr geehrte Damen und Herren,');
  const [einleitung, setEinleitung] = useState(
    'im Folgenden erhalten Sie unser unverbindliches Angebot zur Reinigung Ihrer Räumlichkeiten. Dieses ist auf Ihre Anforderungen abgestimmt und kann nach Absprache jederzeit angepasst werden.'
  );
  const [hinweis, setHinweis] = useState(
    'Reinigungsmaterialien, Wasseraufbereitung und die Anfahrt sind im Preis enthalten. Die Begehung und Flächenaufnahme erfolgt im Rahmen der Objektbesichtigung.'
  );
  const [zusatzhinweis, setZusatzhinweis] = useState('');
  const [kuendigungsfristMonate, setKuendigungsfristMonate] = useState('3');
  const [vertragstext, setVertragstext] = useState(
    'Vertragsunterzeichnung: Nach Auftragserteilung erhalten Sie den Vertrag separat zur Prüfung und Unterzeichnung.'
  );
  const [dankText, setDankText] = useState(
    'Wir danken Ihnen für Ihr Vertrauen und freuen uns auf eine erfolgreiche Zusammenarbeit.\n\nFür Rückfragen stehen wir Ihnen jederzeit gerne zur Verfügung.'
  );
  const [grussformel, setGrussformel] = useState('Mit freundlichen Grüßen\n\nIhr Clean Connect Team');

  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [resultLink, setResultLink] = useState('');
  const [offerId, setOfferId] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');

  const gesamtPreis = (Number(nettobetragUHR) || 0) + (Number(nettobetragGlas) || 0);
  const hasGlasSections = sections.some((s) => isGlasSection(s.title));

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
    setOfferNumberLoading(true);
    getNextOfferNumber(token)
      .then((n) => {
        if (!cancelled && n) setOfferNumber(n);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setOfferNumberLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

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
    setKunde(c.name);
    setShowSuggestions(false);
    setShowNewContact(false);
    setAnrede(salutationForContact(c));
  }

  async function handleSubmit() {
    if (!token.trim()) {
      setStatus('error');
      setMessage('Bitte API Token eingeben.');
      return;
    }
    const kundeName = showNewContact ? ncFirma.trim() : kunde.trim();
    if (!kundeName) {
      setStatus('error');
      setMessage('Bitte Kundenname eingeben.');
      return;
    }
    if (!offerNumber) {
      setStatus('error');
      setMessage('Angebotsnummer konnte nicht von sevDesk geladen werden.');
      return;
    }
    setStatus('loading');
    setMessage('');
    try {
      let contactId = selectedContact?.id;
      if (!contactId) {
        const created = await createContact(token, {
          name: kundeName,
          street: showNewContact ? ncStrasse.trim() : '',
          zip: showNewContact ? ncPlz.trim() : '',
          city: showNewContact ? ncStadt.trim() : '',
          email: showNewContact ? ncEmail.trim() : '',
        });
        contactId = created?.id;
      }
      if (!contactId) throw new Error('Kunde konnte nicht ermittelt oder erstellt werden.');

      const header = `Angebot ${offerNumber}`;
      // sevDesk speichert Kopf-/Fußtext als HTML: jeder Absatz braucht ein
      // eigenes <p>, sonst werden Zeilenumbrüche beim Rendern verschluckt
      // und Sätze laufen ohne Leerzeichen ineinander.
      const asParagraphs = (blocks) =>
        blocks
          .filter(Boolean)
          .flatMap((b) => b.split(/\n\s*\n/))
          .filter((p) => p.trim())
          .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
          .join('');
      const headText = asParagraphs([anrede, einleitung]);
      const footText = asParagraphs([
        hinweis,
        zusatzhinweis.trim(),
        `Gültigkeit: Dieses Angebot ist bis zum ${formatDateDE(gueltigBis)} gültig.`,
        `Kündigungsfrist: Der Vertrag ist mit einer Frist von ${kuendigungsfristMonate} Monaten zum Monatsende kündbar.`,
        vertragstext,
        dankText,
        grussformel,
      ]);

      const offer = await createOffer(token, {
        contactId,
        header,
        headText,
        footText,
        offerNumber,
        offerDate: leistungsbeginn,
        timeToPay: Number(zahlungsziel) || 14,
        sections,
        nettobetragUHR,
        nettobetragGlas,
        objekt,
        intervallInfo,
        standDatum: datum,
      });
      const newOfferId = offer?.id;
      if (!newOfferId) throw new Error('Angebot konnte nicht erstellt werden.');

      setStatus('success');
      setOfferId(newOfferId);
      setResultLink(`https://my.sevdesk.de/om/detail/type/AN/id/${newOfferId}`);
      setMessage(`Angebot ${offerNumber} erfolgreich in sevDesk erstellt.`);
    } catch (err) {
      setStatus('error');
      setMessage(err?.message || err?.toString() || 'Unbekannter Fehler');
    }
  }

  async function handleDownloadPdf() {
    if (!offerId) return;
    setPdfLoading(true);
    setPdfError('');
    try {
      const res = await fetch(`/api/sevdesk/offer-pdf/${offerId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `PDF nicht verfügbar (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeObjekt = (objekt || 'Objekt').replace(/[^a-zA-Z0-9äöüÄÖÜß_]+/g, '_');
      a.href = url;
      a.download = `Angebot_${offerNumber}_${safeObjekt}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setPdfError(err?.message || err?.toString() || 'Unbekannter Fehler');
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal sevdesk-modal" onClick={(e) => e.stopPropagation()}>
        <h2>An sevDesk senden</h2>
        <p className="modal-hint">Erstellt ein Angebot in sevDesk mit allen Positionen aus diesem LV.</p>

        <label className="modal-field">
          sevDesk API Token
          {tokenFromServer ? (
            <div className="token-badge">
              ✓ Server Token aktiv
              <button
                type="button"
                onClick={() => {
                  setTokenFromServer(false);
                  setToken('');
                }}
              >
                Anderen Token verwenden
              </button>
            </div>
          ) : (
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="API Token einfügen"
            />
          )}
        </label>

        {status === 'success' ? (
          <div className="modal-message success">
            <div className="offer-number-display">{offerNumber}</div>
            {message}
            <div className="offer-success-actions">
              <button type="button" onClick={handleDownloadPdf} disabled={pdfLoading}>
                {pdfLoading ? 'Lädt...' : 'Angebot als PDF herunterladen'}
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('lv-export-pdf'))}
              >
                Leistungsverzeichnis als PDF herunterladen
              </button>
              <a href={resultLink} target="_blank" rel="noreferrer">
                In sevDesk öffnen
              </a>
              {pdfError && <div className="modal-message error">{pdfError}</div>}
            </div>
          </div>
        ) : (
          <>
            {!showNewContact && (
              <label className="modal-field autocomplete-wrap">
                Kundenname / Firma
                <input
                  type="text"
                  value={kunde}
                  onChange={(e) => handleKundeChange(e.target.value)}
                  onFocus={() => setShowSuggestions(contactSuggestions.length > 0)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="Kunde suchen"
                />
                {showSuggestions && contactSuggestions.length > 0 && (
                  <ul className="autocomplete-list">
                    {contactSuggestions.map((c) => (
                      <li key={c.id} onMouseDown={() => pickContact(c)}>
                        {c.city ? `${c.name}, ${c.city}` : c.name}
                      </li>
                    ))}
                  </ul>
                )}
              </label>
            )}

            <button
              type="button"
              onClick={() => setShowNewContact((v) => !v)}
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
                  Ansprechpartner
                  <input
                    type="text"
                    value={ncAnsprechpartner}
                    onChange={(e) => setNcAnsprechpartner(e.target.value)}
                  />
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
                  E Mail
                  <input type="email" value={ncEmail} onChange={(e) => setNcEmail(e.target.value)} />
                </label>
              </>
            )}

            <hr className="modal-section-divider" />
            <div className="modal-subheading">Angebot</div>

            <label className="modal-field">
              Angebotsnummer
              <input
                type="text"
                value={offerNumberLoading ? 'Lädt...' : offerNumber}
                readOnly
              />
            </label>

            {!showNewContact && (
              <label className="modal-field">
                Ansprechpartner
                <input
                  type="text"
                  value={ansprechpartner}
                  onChange={(e) => setAnsprechpartner(e.target.value)}
                />
              </label>
            )}

            <div className="modal-field-row">
              <label className="modal-field">
                Leistungsbeginn
                <input
                  type="date"
                  value={leistungsbeginn}
                  onChange={(e) => setLeistungsbeginn(e.target.value)}
                />
              </label>
              <label className="modal-field">
                Gültig bis
                <input type="date" value={gueltigBis} onChange={(e) => setGueltigBis(e.target.value)} />
              </label>
            </div>

            <label className="modal-field">
              Zahlungsziel (Tage)
              <input
                type="number"
                value={zahlungsziel}
                onChange={(e) => setZahlungsziel(e.target.value)}
              />
            </label>

            <div className="modal-subheading">Preise</div>
            <label className="modal-field">
              Nettobetrag Unterhaltsreinigung (€)
              <input
                type="number"
                value={nettobetragUHR}
                onChange={(e) => setNettobetragUHR(e.target.value)}
                placeholder="0.00"
              />
            </label>
            {hasGlasSections && (
              <label className="modal-field">
                Nettobetrag Glasreinigung (€)
                <input
                  type="number"
                  value={nettobetragGlas}
                  onChange={(e) => setNettobetragGlas(e.target.value)}
                  placeholder="0.00"
                />
              </label>
            )}
            <div className="price-summary-total">Gesamt: {gesamtPreis.toFixed(2)} €</div>

            <hr className="modal-section-divider" />
            <button type="button" onClick={() => setShowTexts((v) => !v)} style={{ marginBottom: 12 }}>
              {showTexts ? 'Kopf- und Fußtext ausblenden' : 'Kopf- und Fußtext bearbeiten'}
            </button>

            {showTexts && (
              <>
                <div className="modal-subheading">Kopftext</div>
                <label className="modal-field">
                  Anrede
                  <input type="text" value={anrede} onChange={(e) => setAnrede(e.target.value)} />
                </label>
                <label className="modal-field">
                  Einleitungstext
                  <textarea rows={3} value={einleitung} onChange={(e) => setEinleitung(e.target.value)} />
                </label>

                <div className="modal-subheading">Fußtext</div>
                <label className="modal-field">
                  Hinweis
                  <textarea rows={3} value={hinweis} onChange={(e) => setHinweis(e.target.value)} />
                </label>
                <label className="modal-field">
                  Zusätzlicher Hinweis (optional, z. B. Preisnachlass)
                  <textarea
                    rows={2}
                    value={zusatzhinweis}
                    onChange={(e) => setZusatzhinweis(e.target.value)}
                  />
                </label>
                <label className="modal-field">
                  Kündigungsfrist (Monate)
                  <input
                    type="number"
                    value={kuendigungsfristMonate}
                    onChange={(e) => setKuendigungsfristMonate(e.target.value)}
                  />
                </label>
                <label className="modal-field">
                  Vertragsunterzeichnung
                  <textarea rows={2} value={vertragstext} onChange={(e) => setVertragstext(e.target.value)} />
                </label>
                <label className="modal-field">
                  Dank / Schlusstext
                  <textarea rows={3} value={dankText} onChange={(e) => setDankText(e.target.value)} />
                </label>
                <label className="modal-field">
                  Grußformel
                  <textarea rows={3} value={grussformel} onChange={(e) => setGrussformel(e.target.value)} />
                </label>
              </>
            )}

            {message && <div className={`modal-message ${status}`}>{message}</div>}
          </>
        )}

        <div className="modal-actions">
          <button onClick={onClose}>{status === 'success' ? 'Schließen' : 'Abbrechen'}</button>
          {status !== 'success' && (
            <button className="primary" onClick={handleSubmit} disabled={status === 'loading'}>
              {status === 'loading' ? 'Sende...' : 'Angebot erstellen'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

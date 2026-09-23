import React, { useEffect, useRef, useState } from 'react';
import { searchContacts, createContact, getContactAddress } from '../lib/sevdesk.js';
import {
  AREA_DEFINITIONS,
  AREA_ORDER,
  OBJEKT_TYPEN,
  OBJEKT_TYP_ORDER,
  areasForObjektTyp,
  buildSectionsFromSetup,
  buildSingleServiceMain,
} from '../templates/checklistAreas.js';
import WeekdaySelector from './WeekdaySelector.jsx';
import DiktatButton from './DiktatButton.jsx';

const TOKEN_KEY = 'lv-tool:sevdesk-token';
const FREQUENCIES = ['1x', '2x', '3x', '4x', '5x', '6x', '7x'];
const LAMELLEN_FREQUENCIES = Array.from({ length: 12 }, (_, i) => `${i + 1}x`);

function addressLine(addr) {
  if (!addr) return '';
  return [addr.street, [addr.zip, addr.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

export default function QuickSetup({ onGenerate, onCancel, onGenerateFromFile, heading = 'Neues Leistungsverzeichnis' }) {
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

  // 'unterhalt' = normales Unterhaltsreinigungs-LV (Standard, wie bisher),
  // 'einzelleistung' = eigenständiges LV NUR für eine Leistung, ohne
  // Unterhaltsreinigungs-Basis (z.B. nur Glasreinigung als Auftrag).
  const [mode, setMode] = useState('unterhalt');
  const [singleService, setSingleService] = useState('glasreinigung');
  const [singleServiceTitle, setSingleServiceTitle] = useState('');

  // Besichtigung einsprechen oder eintippen -> Vorbelegung der Schritte 1-3
  const [besichtigung, setBesichtigung] = useState('');
  const [besichtigungStatus, setBesichtigungStatus] = useState('idle'); // idle | denkt | fehler
  const [besichtigungFehler, setBesichtigungFehler] = useState('');
  const [besichtigungHinweis, setBesichtigungHinweis] = useState('');

  // Schritt 1-4
  const [objektTyp, setObjektTyp] = useState('');
  const [frequency, setFrequency] = useState('2x');
  const [wochentage, setWochentage] = useState([]);
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

  // Ein Objekttyp ist ein Startpunkt, keine feste Vorlage: er hakt die
  // typischen Bereiche vor und setzt eine übliche Frequenz. Danach bleibt
  // alles einzeln änderbar.
  function pickObjektTyp(key) {
    setObjektTyp(key);
    const typ = OBJEKT_TYPEN[key];
    if (!typ) return;
    setAreas(areasForObjektTyp(key));
    setFrequency(typ.frequency);
    setWochentage([]);
  }

  // Schickt die geschilderte Besichtigung an den Assistenten und übernimmt
  // dessen Vorschlag als Vorbelegung. Nichts davon ist endgültig - alle
  // Haken bleiben danach normal bedienbar.
  async function besichtigungAuswerten() {
    const text = besichtigung.trim();
    if (!text) return;
    setBesichtigungStatus('denkt');
    setBesichtigungFehler('');
    setBesichtigungHinweis('');
    try {
      const res = await fetch('/api/lv/setup-aus-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          areaListe: AREA_ORDER.map((key) => ({ key, label: AREA_DEFINITIONS[key].label })),
          typListe: OBJEKT_TYP_ORDER.map((key) => ({ key, label: OBJEKT_TYPEN[key].label })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) throw new Error(data?.error || 'Unbekannter Fehler');

      if (data.objektTyp) setObjektTyp(data.objektTyp);
      if (data.frequenz) {
        setFrequency(data.frequenz);
        setWochentage([]);
      }
      if (Array.isArray(data.areas) && data.areas.length > 0) {
        const next = Object.fromEntries(AREA_ORDER.map((k) => [k, false]));
        data.areas.forEach((k) => {
          if (k in next) next[k] = true;
        });
        setAreas(next);
      }
      if (data.glas) setGlasEnabled(true);
      if (data.winterdienst) setWinterdienst(true);
      setBesichtigungHinweis(data.hinweis || '');
      setBesichtigungStatus('idle');
    } catch (err) {
      setBesichtigungFehler(err?.message || 'Unbekannter Fehler');
      setBesichtigungStatus('fehler');
    }
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
    const { main, children, lvTitle } =
      mode === 'einzelleistung'
        ? { ...buildSingleServiceMain(singleService, singleServiceTitle), children: [] }
        : buildSectionsFromSetup({
            frequency,
            wochentage,
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

    onGenerate({ sections: main, children, customer, lvTitle });
  }

  return (
    <div className="overview-page">
      <div className="overview-page-card quick-setup-card">
        <h2>{heading}</h2>
        <p className="modal-hint">
          Kundendaten und Grundeinstellungen festlegen, dann das Leistungsverzeichnis generieren.
        </p>

        {onGenerateFromFile && (
          <button type="button" className="lv-from-file-btn" onClick={onGenerateFromFile}>
            📎 LV aus Datei erstellen
          </button>
        )}

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
        <div className="modal-subheading">Art des Auftrags</div>
        <div className="quick-setup-checkbox-list">
          <label className="quick-setup-checkbox">
            <input
              type="radio"
              name="quick-setup-mode"
              checked={mode === 'unterhalt'}
              onChange={() => setMode('unterhalt')}
            />
            Unterhaltsreinigung (Standard)
          </label>
          <label className="quick-setup-checkbox">
            <input
              type="radio"
              name="quick-setup-mode"
              checked={mode === 'einzelleistung'}
              onChange={() => setMode('einzelleistung')}
            />
            Nur Einzelleistung (ohne Unterhaltsreinigung)
          </label>
        </div>

        {mode === 'einzelleistung' ? (
          <>
            <hr className="modal-section-divider" />
            <div className="modal-subheading">Welche Leistung?</div>
            <label className="modal-field">
              Leistung
              <select value={singleService} onChange={(e) => setSingleService(e.target.value)}>
                <option value="glasreinigung">Glasreinigung</option>
                <option value="grundreinigung">Grundreinigung</option>
                <option value="sonstiges">Sonstige Leistung (freier Titel)</option>
              </select>
            </label>
            {singleService === 'sonstiges' && (
              <label className="modal-field">
                Titel der Leistung
                <input
                  type="text"
                  value={singleServiceTitle}
                  onChange={(e) => setSingleServiceTitle(e.target.value)}
                  placeholder="z.B. Teppichreinigung"
                />
              </label>
            )}
          </>
        ) : (
          <>
            <hr className="modal-section-divider" />
            <div className="modal-subheading">Besichtigung einsprechen (optional)</div>
            <p className="modal-hint">
              Erzählen, was vor Ort steht („Erdgeschoss, drei Büros, ein Bad, kleine Küche,
              zweimal die Woche") oder einfach sagen, was gebraucht wird („Leistungsverzeichnis
              für eine Logopädiepraxis, Standard"). Daraus werden die Schritte unten vorbelegt.
            </p>
            <div className="quick-setup-besichtigung">
              <textarea
                rows={3}
                value={besichtigung}
                onChange={(e) => setBesichtigung(e.target.value)}
                placeholder="Aufnahme oder Text der Besichtigung…"
              />
              <div className="quick-setup-besichtigung-actions">
                <DiktatButton
                  disabled={besichtigungStatus === 'denkt'}
                  onFehler={(m) => setBesichtigungFehler(m)}
                  onTranskript={(text) => {
                    setBesichtigungFehler('');
                    // An Vorhandenes anhängen, damit mehrere Räume nacheinander
                    // eingesprochen werden können.
                    setBesichtigung((v) => (v.trim() ? `${v.trim()} ${text}` : text));
                  }}
                />
                <button
                  type="button"
                  onClick={besichtigungAuswerten}
                  disabled={besichtigungStatus === 'denkt' || !besichtigung.trim()}
                >
                  {besichtigungStatus === 'denkt' ? 'Wertet aus…' : 'Übernehmen'}
                </button>
              </div>
              {besichtigungFehler && <div className="modal-message error">{besichtigungFehler}</div>}
              {besichtigungHinweis && (
                <div className="modal-message">Offen geblieben: {besichtigungHinweis}</div>
              )}
            </div>

            <hr className="modal-section-divider" />
            <div className="modal-subheading">Schritt 1 — Art des Objekts</div>
            <p className="modal-hint">
              Wählt die typischen Bereiche und eine übliche Frequenz vor. Beides bleibt danach
              einzeln änderbar.
            </p>
            <div className="quick-setup-typ-list">
              {OBJEKT_TYP_ORDER.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`quick-setup-typ-btn${objektTyp === key ? ' active' : ''}`}
                  onClick={() => pickObjektTyp(key)}
                >
                  {OBJEKT_TYPEN[key].label}
                </button>
              ))}
            </div>

            <hr className="modal-section-divider" />
            <div className="modal-subheading">Schritt 2 — Reinigungsfrequenz</div>
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
            <label className="modal-field">
              An welchen Wochentagen? (optional)
              <WeekdaySelector
                value={wochentage}
                onChange={(days) => {
                  setWochentage(days);
                  if (days.length > 0) setFrequency(`${days.length}x`);
                }}
              />
            </label>

            <hr className="modal-section-divider" />
            <div className="modal-subheading">Schritt 3 — Bereiche auswählen</div>
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
            <div className="modal-subheading">Schritt 4 — Zusatzleistungen</div>
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
                <input
                  type="checkbox"
                  checked={erstreinigung}
                  onChange={(e) => setErstreinigung(e.target.checked)}
                />
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
          </>
        )}

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

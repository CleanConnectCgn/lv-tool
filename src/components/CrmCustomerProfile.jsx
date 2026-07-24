import React, { useEffect, useState } from 'react';
import {
  getCustomer,
  saveCustomerNotes,
  createAuftrag,
  updateAuftrag,
  deleteAuftrag,
  getCalendarStatus,
  listCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  disconnectCalendar,
  mergeCustomer,
  listCustomers,
  listObjekte,
  createObjekt,
  updateObjekt,
  deleteObjekt,
  listMitarbeiter,
} from '../lib/crm.js';
import WeekdaySelector from './WeekdaySelector.jsx';

const VERTRAGSGENERATOR_URL = 'https://vertragsgenerator-production-7738.up.railway.app';
const AUFTRAG_STATUS_OPTIONS = ['offen', 'in Arbeit', 'erledigt', 'storniert'];

// Google Calendar RRULE erwartet BYDAY-Kürzel (MO,TU,...), unsere
// WeekdaySelector-Komponente liefert deutsche Kürzel (Mo,Di,...).
const WEEKDAY_TO_RRULE = { Mo: 'MO', Di: 'TU', Mi: 'WE', Do: 'TH', Fr: 'FR', Sa: 'SA', So: 'SU' };

function buildWeeklyRecurrence(weekdays, untilDate) {
  if (!weekdays?.length) return undefined;
  const byday = weekdays.map((d) => WEEKDAY_TO_RRULE[d]).filter(Boolean).join(',');
  if (!byday) return undefined;
  let rrule = `RRULE:FREQ=WEEKLY;BYDAY=${byday}`;
  if (untilDate) {
    // UNTIL erwartet UTC im Format YYYYMMDDTHHMMSSZ.
    rrule += `;UNTIL=${untilDate.replace(/-/g, '')}T235959Z`;
  }
  return [rrule];
}

function addressLine(c) {
  if (!c) return '';
  return [c.strasse || c.street, [c.plz || c.zip, c.ort || c.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
}

function formatDateTimeDE(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function CrmCustomerProfile({ customerKey, onBack, onOpenDocument }) {
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [notizen, setNotizen] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const [calendarStatus, setCalendarStatus] = useState(null);
  const [events, setEvents] = useState([]);
  const [contracts, setContracts] = useState(null); // null = noch nicht geladen/nicht erreichbar

  const [showNewAuftrag, setShowNewAuftrag] = useState(false);
  const [newTitel, setNewTitel] = useState('');
  const [newDatum, setNewDatum] = useState('');
  const [newUhrzeit, setNewUhrzeit] = useState('09:00');
  const [newWiederholt, setNewWiederholt] = useState(false);
  const [newWiederholTage, setNewWiederholTage] = useState([]);
  const [newWiederholBis, setNewWiederholBis] = useState('');

  const [calendarError, setCalendarError] = useState('');
  const [reschedulingEventId, setReschedulingEventId] = useState(null);
  const [rescheduleDatum, setRescheduleDatum] = useState('');
  const [rescheduleUhrzeit, setRescheduleUhrzeit] = useState('09:00');

  const [showMerge, setShowMerge] = useState(false);
  const [mergeCandidates, setMergeCandidates] = useState([]);
  const [mergeTargetKey, setMergeTargetKey] = useState('');

  const [objekte, setObjekte] = useState([]);
  const [alleMitarbeiter, setAlleMitarbeiter] = useState([]);
  const [showNewObjekt, setShowNewObjekt] = useState(false);
  const [objektName, setObjektName] = useState('');
  const [objektStrasse, setObjektStrasse] = useState('');
  const [objektPlz, setObjektPlz] = useState('');
  const [objektOrt, setObjektOrt] = useState('');
  const [objektMitarbeiterIds, setObjektMitarbeiterIds] = useState([]);

  function load() {
    setStatus('loading');
    getCustomer(customerKey)
      .then((p) => {
        setProfile(p);
        setNotizen(p.notizen || '');
        setStatus('done');
      })
      .catch((err) => {
        setError(err?.message || 'Fehler beim Laden');
        setStatus('error');
      });
  }

  useEffect(load, [customerKey]);

  function loadObjekte() {
    listObjekte(customerKey).then(setObjekte).catch(() => setObjekte([]));
  }

  useEffect(loadObjekte, [customerKey]);
  useEffect(() => {
    listMitarbeiter().then(setAlleMitarbeiter).catch(() => setAlleMitarbeiter([]));
  }, []);

  useEffect(() => {
    if (!profile?.customer?.name) return;
    fetch(`${VERTRAGSGENERATOR_URL}/api/contracts`)
      .then((r) => (r.ok ? r.json() : []))
      .then((all) => {
        const name = profile.customer.name.toLowerCase();
        setContracts((all || []).filter((c) => (c.contract?.kunde?.firma || '').toLowerCase() === name));
      })
      .catch(() => setContracts(null));
  }, [profile]);

  useEffect(() => {
    getCalendarStatus().then(setCalendarStatus).catch(() => setCalendarStatus({ connected: false, configured: false }));
  }, []);

  function loadEvents() {
    if (!calendarStatus?.connected) return;
    setCalendarError('');
    listCalendarEvents({ customerKey })
      .then(setEvents)
      .catch((err) => {
        setEvents([]);
        if (err?.reconnectRequired) {
          setCalendarStatus((prev) => ({ ...prev, connected: false }));
          setCalendarError('Die Google-Kalender-Verbindung ist abgelaufen oder wurde widerrufen. Bitte erneut verbinden.');
        } else {
          setCalendarError(err?.message || 'Kalendertermine konnten nicht geladen werden');
        }
      });
  }

  useEffect(loadEvents, [calendarStatus?.connected, customerKey]);

  async function handleSaveNotes() {
    setSavingNotes(true);
    try {
      await saveCustomerNotes(customerKey, notizen);
    } catch (err) {
      alert(err?.message || 'Notizen konnten nicht gespeichert werden');
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleCopyForContract() {
    // Nimmt das zuletzt aktualisierte Dokument als Quelle für Intervall und
    // Vergütung, damit der bereits in sevDesk kalkulierte Angebotspreis nicht
    // manuell neu eingetippt werden muss.
    const sourceDoc = [...profile.documents].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
    const payload = {
      kunde: {
        firma: profile.customer?.name || '',
        strasse: profile.customer?.strasse || profile.customer?.street || '',
        plz: profile.customer?.plz || profile.customer?.zip || '',
        ort: profile.customer?.ort || profile.customer?.city || '',
      },
      objektAdresse: sourceDoc?.objekt || '',
      reinigungsintervall: sourceDoc?.intervallInfo || '',
      verguetungNetto: sourceDoc?.verguetungNetto || '',
    };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    window.open(VERTRAGSGENERATOR_URL, '_blank');
  }

  async function handleCreateAuftrag() {
    if (!newTitel.trim()) return;
    try {
      const auftrag = await createAuftrag({
        customerKey,
        customerName: profile.customer?.name || '',
        titel: newTitel.trim(),
      });
      if (calendarStatus?.connected && newDatum) {
        const start = `${newDatum}T${newUhrzeit}:00`;
        const startDate = new Date(start);
        const end = new Date(startDate.getTime() + 60 * 60 * 1000).toISOString();
        const recurrence = newWiederholt ? buildWeeklyRecurrence(newWiederholTage, newWiederholBis) : undefined;
        const event = await createCalendarEvent({
          summary: `${newTitel.trim()} — ${profile.customer?.name || ''}`,
          start: { dateTime: startDate.toISOString(), timeZone: 'Europe/Berlin' },
          end: { dateTime: end, timeZone: 'Europe/Berlin' },
          recurrence,
          customerKey,
          auftragId: auftrag.id,
        });
        await updateAuftrag(auftrag.id, { calendarEventIds: [event.id] });
      }
      setShowNewAuftrag(false);
      setNewTitel('');
      setNewDatum('');
      setNewWiederholt(false);
      setNewWiederholTage([]);
      setNewWiederholBis('');
      load();
      loadEvents();
    } catch (err) {
      alert(err?.message || 'Auftrag konnte nicht angelegt werden');
    }
  }

  async function handleDeleteAuftrag(auftrag) {
    if (!window.confirm(`Auftrag "${auftrag.titel}" wirklich löschen?`)) return;
    try {
      await deleteAuftrag(auftrag.id);
      for (const eventId of auftrag.calendarEventIds || []) {
        await deleteCalendarEvent(eventId).catch(() => {});
      }
      load();
      loadEvents();
    } catch (err) {
      alert(err?.message || 'Auftrag konnte nicht gelöscht werden');
    }
  }

  async function handleAuftragStatusChange(auftrag, newStatus) {
    try {
      await updateAuftrag(auftrag.id, { status: newStatus });
      setProfile((prev) => ({
        ...prev,
        auftraege: prev.auftraege.map((a) => (a.id === auftrag.id ? { ...a, status: newStatus } : a)),
      }));
    } catch (err) {
      alert(err?.message || 'Status konnte nicht geändert werden');
    }
  }

  function startReschedule(event) {
    const d = new Date(event.start?.dateTime || event.start?.date);
    setReschedulingEventId(event.id);
    setRescheduleDatum(d.toISOString().slice(0, 10));
    setRescheduleUhrzeit(d.toISOString().slice(11, 16));
  }

  async function handleSaveReschedule(event) {
    try {
      const start = new Date(`${rescheduleDatum}T${rescheduleUhrzeit}:00`);
      const durationMs =
        new Date(event.end?.dateTime || event.end?.date).getTime() -
        new Date(event.start?.dateTime || event.start?.date).getTime();
      const end = new Date(start.getTime() + (durationMs > 0 ? durationMs : 60 * 60 * 1000));
      await updateCalendarEvent(event.id, {
        start: { dateTime: start.toISOString(), timeZone: 'Europe/Berlin' },
        end: { dateTime: end.toISOString(), timeZone: 'Europe/Berlin' },
      });
      setReschedulingEventId(null);
      loadEvents();
    } catch (err) {
      if (err?.reconnectRequired) {
        setCalendarStatus((prev) => ({ ...prev, connected: false }));
        setCalendarError('Die Google-Kalender-Verbindung ist abgelaufen. Bitte erneut verbinden.');
      } else {
        alert(err?.message || 'Termin konnte nicht verschoben werden');
      }
    }
  }

  async function handleDisconnectCalendar() {
    if (!window.confirm('Google-Kalender-Verbindung wirklich trennen?')) return;
    try {
      await disconnectCalendar();
      setCalendarStatus((prev) => ({ ...prev, connected: false }));
      setEvents([]);
    } catch (err) {
      alert(err?.message || 'Verbindung konnte nicht getrennt werden');
    }
  }

  async function openMergeDialog() {
    setShowMerge(true);
    try {
      const all = await listCustomers();
      setMergeCandidates(all.filter((c) => c.key !== customerKey));
    } catch (err) {
      setMergeCandidates([]);
    }
  }

  async function handleMerge() {
    if (!mergeTargetKey) return;
    const targetName = mergeCandidates.find((c) => c.key === mergeTargetKey)?.customer?.name || '';
    if (
      !window.confirm(
        `"${profile.customer?.name}" wirklich in "${targetName}" zusammenführen? Alle Dokumente und Aufträge werden übernommen, nichts wird gelöscht.`
      )
    )
      return;
    try {
      await mergeCustomer(customerKey, mergeTargetKey);
      onBack();
    } catch (err) {
      alert(err?.message || 'Zusammenführen fehlgeschlagen');
    }
  }

  function toggleObjektMitarbeiter(id) {
    setObjektMitarbeiterIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleCreateObjekt() {
    if (!objektName.trim()) return;
    try {
      await createObjekt({
        customerKey,
        name: objektName.trim(),
        strasse: objektStrasse,
        plz: objektPlz,
        ort: objektOrt,
        mitarbeiterIds: objektMitarbeiterIds,
      });
      setShowNewObjekt(false);
      setObjektName('');
      setObjektStrasse('');
      setObjektPlz('');
      setObjektOrt('');
      setObjektMitarbeiterIds([]);
      loadObjekte();
    } catch (err) {
      alert(err?.message || 'Objekt konnte nicht angelegt werden');
    }
  }

  async function handleToggleObjektMitarbeiterAssignment(objekt, mitarbeiterId) {
    const next = objekt.mitarbeiterIds.includes(mitarbeiterId)
      ? objekt.mitarbeiterIds.filter((id) => id !== mitarbeiterId)
      : [...objekt.mitarbeiterIds, mitarbeiterId];
    try {
      await updateObjekt(objekt.id, { mitarbeiterIds: next });
      loadObjekte();
    } catch (err) {
      alert(err?.message || 'Zuweisung konnte nicht geändert werden');
    }
  }

  async function handleDeleteObjekt(objekt) {
    if (!window.confirm(`Objekt "${objekt.name}" wirklich löschen?`)) return;
    try {
      await deleteObjekt(objekt.id);
      loadObjekte();
    } catch (err) {
      alert(err?.message || 'Objekt konnte nicht gelöscht werden');
    }
  }

  if (status === 'loading') return <div className="overview-page"><p className="modal-hint">Lädt...</p></div>;
  if (status === 'error') return <div className="overview-page"><div className="modal-message error">{error}</div></div>;

  return (
    <div className="overview-page">
      <div className="overview-page-card">
        <div className="modal-actions" style={{ marginBottom: 16 }}>
          <button onClick={onBack}>Zurück zu Kunden</button>
          <button onClick={openMergeDialog}>Mit anderem Kunden zusammenführen</button>
        </div>

        <h2>{profile.customer?.name || 'Unbenannt'}</h2>
        <p className="modal-hint">{addressLine(profile.customer)}</p>

        {showMerge && (
          <div className="import-box">
            <p className="modal-hint">
              Führt diesen Kunden vollständig in einen anderen zusammen (z.B. bei doppelter Anlage wegen
              Schreibfehlern). Alle Dokumente und Aufträge werden übernommen, nichts wird gelöscht.
            </p>
            <label className="modal-field">
              Ziel-Kunde
              <select value={mergeTargetKey} onChange={(e) => setMergeTargetKey(e.target.value)}>
                <option value="">Bitte wählen</option>
                {mergeCandidates.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.customer?.name || 'Unbenannt'}
                  </option>
                ))}
              </select>
            </label>
            <div className="modal-actions">
              <button onClick={() => setShowMerge(false)}>Abbrechen</button>
              <button className="primary" onClick={handleMerge} disabled={!mergeTargetKey}>
                Zusammenführen
              </button>
            </div>
          </div>
        )}

        <button type="button" className="lv-from-file-btn" onClick={handleCopyForContract}>
          📄 Vertrag für diesen Kunden erstellen (öffnet Vertragsgenerator)
        </button>

        {contracts && contracts.length > 0 && (
          <>
            <div className="modal-subheading">Verträge (Vertragsgenerator)</div>
            {contracts.map((c) => (
              <div key={c.id} className="overview-row">
                <div className="overview-row-main">
                  <div className="overview-row-title">{c.contract?.vertragsnummer || 'ohne Nummer'}</div>
                  <div className="overview-row-sub">
                    {c.freigabe === 'bereit' ? '✓ Bereit' : c.freigabe ? '⚠ Überarbeitung empfohlen' : 'nicht geprüft'}
                  </div>
                </div>
                <div className="overview-row-meta">
                  <span>{formatDateTimeDE(c.updatedAt)}</span>
                </div>
              </div>
            ))}
          </>
        )}

        <hr className="modal-section-divider" />
        <div className="modal-subheading">Leistungsverzeichnisse & Angebote</div>
        {profile.documents.length === 0 && <p className="modal-hint">Keine Dokumente.</p>}
        {profile.documents.map((d) => (
          <div key={d.id} className="overview-row" onClick={() => onOpenDocument(d.id)}>
            <div className="overview-row-main">
              <div className="overview-row-title">{d.objekt || d.lvTitle}</div>
              <div className="overview-row-sub">
                {d.lvTitle}
                {d.offerNumber ? ` · Angebot ${d.offerNumber}` : ''}
              </div>
            </div>
            <div className="overview-row-meta">
              <span>{formatDateTimeDE(d.updatedAt)}</span>
            </div>
          </div>
        ))}

        <hr className="modal-section-divider" />
        <div className="modal-subheading">Objekte</div>
        {objekte.length === 0 && <p className="modal-hint">Keine Objekte angelegt.</p>}
        {objekte.map((o) => (
          <div key={o.id} className="ai-issue-card">
            <div className="ai-issue-header">
              <span className="ai-issue-title">{o.name}</span>
            </div>
            <p className="ai-issue-desc">{addressLine(o)}</p>
            <div>
              <span className="modal-hint">Zugewiesene Mitarbeiter:</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {alleMitarbeiter.length === 0 && <span className="modal-hint">Keine Mitarbeiter angelegt.</span>}
                {alleMitarbeiter.map((m) => (
                  <label key={m.id} className="checkbox-field" style={{ marginBottom: 0 }}>
                    <input
                      type="checkbox"
                      checked={o.mitarbeiterIds.includes(m.id)}
                      onChange={() => handleToggleObjektMitarbeiterAssignment(o, m.id)}
                    />
                    {m.name}
                  </label>
                ))}
              </div>
            </div>
            <button className="icon-btn" onClick={() => handleDeleteObjekt(o)} style={{ marginTop: 8 }}>
              Objekt löschen
            </button>
          </div>
        ))}

        {!showNewObjekt && (
          <button type="button" onClick={() => setShowNewObjekt(true)}>
            + Objekt anlegen
          </button>
        )}
        {showNewObjekt && (
          <div className="import-box">
            <label className="modal-field">
              Bezeichnung
              <input value={objektName} onChange={(e) => setObjektName(e.target.value)} placeholder="z.B. Hauptsitz, Filiale Nord" />
            </label>
            <div className="modal-field-row">
              <label className="modal-field">
                Straße
                <input value={objektStrasse} onChange={(e) => setObjektStrasse(e.target.value)} />
              </label>
              <label className="modal-field">
                PLZ
                <input value={objektPlz} onChange={(e) => setObjektPlz(e.target.value)} />
              </label>
              <label className="modal-field">
                Ort
                <input value={objektOrt} onChange={(e) => setObjektOrt(e.target.value)} />
              </label>
            </div>
            <span className="modal-hint">Mitarbeiter zuweisen:</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '6px 0 12px' }}>
              {alleMitarbeiter.map((m) => (
                <label key={m.id} className="checkbox-field" style={{ marginBottom: 0 }}>
                  <input
                    type="checkbox"
                    checked={objektMitarbeiterIds.includes(m.id)}
                    onChange={() => toggleObjektMitarbeiter(m.id)}
                  />
                  {m.name}
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowNewObjekt(false)}>Abbrechen</button>
              <button className="primary" onClick={handleCreateObjekt}>
                Anlegen
              </button>
            </div>
          </div>
        )}

        <hr className="modal-section-divider" />
        <div className="modal-subheading">Aufträge</div>
        {!calendarStatus?.configured && (
          <p className="modal-hint">
            Google Kalender ist noch nicht eingerichtet — Aufträge können ohne Kalendertermin angelegt werden.
          </p>
        )}
        {calendarError && <div className="modal-message error">{calendarError}</div>}
        {calendarStatus?.configured && !calendarStatus?.connected && (
          <a className="import-toggle-btn" href="/api/calendar/oauth/start" style={{ display: 'block', textAlign: 'center' }}>
            🔗 Google Kalender verbinden
          </a>
        )}
        {calendarStatus?.connected && (
          <button type="button" onClick={handleDisconnectCalendar} style={{ marginBottom: 12 }}>
            Kalender-Verbindung trennen
          </button>
        )}

        {profile.auftraege.map((a) => (
          <div key={a.id} className="ai-issue-card">
            <div className="ai-issue-header">
              <span className="ai-issue-title">{a.titel}</span>
            </div>
            {a.calendarEventIds?.length > 0 && <p className="ai-issue-desc">📅 Kalendertermin verknüpft</p>}
            <div className="modal-field-row" style={{ alignItems: 'center', marginTop: 8 }}>
              <label className="modal-field" style={{ maxWidth: 180 }}>
                Status
                <select value={a.status} onChange={(e) => handleAuftragStatusChange(a, e.target.value)}>
                  {AUFTRAG_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <button className="icon-btn" onClick={() => handleDeleteAuftrag(a)}>
                Löschen
              </button>
            </div>
          </div>
        ))}

        {!showNewAuftrag && (
          <button type="button" onClick={() => setShowNewAuftrag(true)}>
            + Auftrag anlegen
          </button>
        )}
        {showNewAuftrag && (
          <div className="import-box">
            <label className="modal-field">
              Titel
              <input value={newTitel} onChange={(e) => setNewTitel(e.target.value)} placeholder="z.B. Unterhaltsreinigung" />
            </label>
            {calendarStatus?.connected && (
              <div className="modal-field-row">
                <label className="modal-field">
                  Datum (optional, für Kalendertermin)
                  <input type="date" value={newDatum} onChange={(e) => setNewDatum(e.target.value)} />
                </label>
                <label className="modal-field">
                  Uhrzeit
                  <input type="time" value={newUhrzeit} onChange={(e) => setNewUhrzeit(e.target.value)} />
                </label>
              </div>
            )}
            {calendarStatus?.connected && newDatum && (
              <>
                <label className="checkbox-field">
                  <input type="checkbox" checked={newWiederholt} onChange={(e) => setNewWiederholt(e.target.checked)} />
                  Wiederkehrender Termin
                </label>
                {newWiederholt && (
                  <div className="import-box" style={{ background: '#fafbfb' }}>
                    <span className="modal-hint">An welchen Wochentagen wiederholen?</span>
                    <WeekdaySelector value={newWiederholTage} onChange={setNewWiederholTage} />
                    <label className="modal-field" style={{ marginTop: 8 }}>
                      Wiederholen bis (optional, sonst unbegrenzt)
                      <input type="date" value={newWiederholBis} onChange={(e) => setNewWiederholBis(e.target.value)} />
                    </label>
                  </div>
                )}
              </>
            )}
            <div className="modal-actions">
              <button onClick={() => setShowNewAuftrag(false)}>Abbrechen</button>
              <button className="primary" onClick={handleCreateAuftrag}>
                Anlegen
              </button>
            </div>
          </div>
        )}

        {calendarStatus?.connected && (
          <>
            <hr className="modal-section-divider" />
            <div className="modal-subheading">Anstehende Kalendertermine</div>
            {events.length === 0 && <p className="modal-hint">Keine anstehenden Termine für diesen Kunden.</p>}
            {events.map((e) => (
              <div key={e.id} className="overview-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <div className="overview-row-main">
                    <div className="overview-row-title">{e.summary}</div>
                    <div className="overview-row-sub">{formatDateTimeDE(e.start?.dateTime || e.start?.date)}</div>
                  </div>
                  {reschedulingEventId !== e.id && (
                    <button className="icon-btn" onClick={() => startReschedule(e)}>
                      Verschieben
                    </button>
                  )}
                </div>
                {reschedulingEventId === e.id && (
                  <div className="modal-field-row" style={{ marginTop: 8 }}>
                    <label className="modal-field">
                      Datum
                      <input type="date" value={rescheduleDatum} onChange={(ev) => setRescheduleDatum(ev.target.value)} />
                    </label>
                    <label className="modal-field">
                      Uhrzeit
                      <input type="time" value={rescheduleUhrzeit} onChange={(ev) => setRescheduleUhrzeit(ev.target.value)} />
                    </label>
                    <button onClick={() => setReschedulingEventId(null)}>Abbrechen</button>
                    <button className="primary" onClick={() => handleSaveReschedule(e)}>
                      Speichern
                    </button>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        <hr className="modal-section-divider" />
        <div className="modal-subheading">Notizen (intern)</div>
        <textarea
          className="inspection-note-textarea"
          value={notizen}
          onChange={(e) => setNotizen(e.target.value)}
          placeholder="Interne Notizen zu diesem Kunden..."
        />
        <button type="button" onClick={handleSaveNotes} disabled={savingNotes}>
          {savingNotes ? 'Speichert...' : 'Notizen speichern'}
        </button>
      </div>
    </div>
  );
}

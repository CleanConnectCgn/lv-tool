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
  deleteCalendarEvent,
} from '../lib/crm.js';

const VERTRAGSGENERATOR_URL = 'https://vertragsgenerator-production-7738.up.railway.app';

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

  useEffect(() => {
    if (!calendarStatus?.connected) return;
    listCalendarEvents({ customerKey }).then(setEvents).catch(() => setEvents([]));
  }, [calendarStatus, customerKey]);

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
    const payload = {
      kunde: {
        firma: profile.customer?.name || '',
        strasse: profile.customer?.strasse || profile.customer?.street || '',
        plz: profile.customer?.plz || profile.customer?.zip || '',
        ort: profile.customer?.ort || profile.customer?.city || '',
      },
      objektAdresse: profile.documents[0]?.objekt || '',
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
        const event = await createCalendarEvent({
          summary: `${newTitel.trim()} — ${profile.customer?.name || ''}`,
          start: { dateTime: startDate.toISOString() },
          end: { dateTime: end },
          customerKey,
          auftragId: auftrag.id,
        });
        await updateAuftrag(auftrag.id, { calendarEventIds: [event.id] });
      }
      setShowNewAuftrag(false);
      setNewTitel('');
      setNewDatum('');
      load();
      if (calendarStatus?.connected) listCalendarEvents({ customerKey }).then(setEvents).catch(() => {});
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
    } catch (err) {
      alert(err?.message || 'Auftrag konnte nicht gelöscht werden');
    }
  }

  if (status === 'loading') return <div className="overview-page"><p className="modal-hint">Lädt...</p></div>;
  if (status === 'error') return <div className="overview-page"><div className="modal-message error">{error}</div></div>;

  return (
    <div className="overview-page">
      <div className="overview-page-card">
        <div className="modal-actions" style={{ marginBottom: 16 }}>
          <button onClick={onBack}>Zurück zu Kunden</button>
        </div>

        <h2>{profile.customer?.name || 'Unbenannt'}</h2>
        <p className="modal-hint">{addressLine(profile.customer)}</p>

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
        <div className="modal-subheading">Aufträge</div>
        {!calendarStatus?.configured && (
          <p className="modal-hint">
            Google Kalender ist noch nicht eingerichtet — Aufträge können ohne Kalendertermin angelegt werden.
          </p>
        )}
        {calendarStatus?.configured && !calendarStatus?.connected && (
          <a className="import-toggle-btn" href="/api/calendar/oauth/start" style={{ display: 'block', textAlign: 'center' }}>
            🔗 Google Kalender verbinden
          </a>
        )}

        {profile.auftraege.map((a) => (
          <div key={a.id} className="ai-issue-card">
            <div className="ai-issue-header">
              <span className="ai-issue-title">{a.titel}</span>
            </div>
            <p className="ai-issue-desc">Status: {a.status}</p>
            {a.calendarEventIds?.length > 0 && <p className="ai-issue-desc">📅 Kalendertermin verknüpft</p>}
            <button className="icon-btn" onClick={() => handleDeleteAuftrag(a)}>
              Löschen
            </button>
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
              <div key={e.id} className="overview-row">
                <div className="overview-row-main">
                  <div className="overview-row-title">{e.summary}</div>
                  <div className="overview-row-sub">{formatDateTimeDE(e.start?.dateTime || e.start?.date)}</div>
                </div>
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

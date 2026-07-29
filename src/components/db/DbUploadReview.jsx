import React, { useState, useEffect } from 'react';
import {
  uploadDocumentForExtraction,
  retryUpload,
  createCatalogItem,
  createServiceSpec,
  listElementGroups,
} from '../../lib/dbCrm.js';

const VERBS = [
  'ENTSTAUBEN',
  'ABSAUGEN',
  'FEUCHT_WISCHEN',
  'NASS_WISCHEN',
  'FEUCHT_REINIGEN',
  'DESINFIZIEREND_REINIGEN',
  'FLECKENFREI_REINIGEN',
  'GRIFFSPUREN_ENTFERNEN',
  'ENTLEEREN_UND_ENTSORGEN',
  'ENTKALKEN',
];

function draftFromMatch(m) {
  let mode = 'woechentlich';
  let value = '1';
  if (m.nachBedarf) mode = 'bedarf';
  else if (m.einmalig) mode = 'einmalig';
  else if (m.woechentlich) {
    mode = 'woechentlich';
    value = String(m.woechentlich);
  } else if (m.monatlich) {
    mode = 'monatlich';
    value = String(m.monatlich);
  } else if (m.jaehrlich) {
    mode = 'jaehrlich';
    value = String(m.jaehrlich);
  }
  return {
    originalText: m.originalText,
    catalogItemId: m.catalogItemId,
    roomAreaId: '',
    mode,
    value,
    bemerkung: m.bemerkung || '',
  };
}

// Block 7: Upload -> Auslesung -> IMMER menschlich bestätigter Review, bevor
// irgendein Leistungsverzeichnis entsteht. objectId ist hier immer bekannt
// (Aufruf aus der Objektansicht), daher entfällt eine "welchem Objekt
// zuordnen"-Zwischenfrage.
export default function DbUploadReview({ objectId, catalog, roomAreas, onDone, onCancel }) {
  const [state, setState] = useState('idle'); // idle | uploading | review | saving | done
  const [error, setError] = useState('');
  const [uploadId, setUploadId] = useState(null);
  const [leistungsart, setLeistungsart] = useState('Unterhaltsreinigung');
  const [matchedDrafts, setMatchedDrafts] = useState([]);
  const [unmatchedDrafts, setUnmatchedDrafts] = useState([]);
  const [localCatalog, setLocalCatalog] = useState(catalog);
  const [assigningIndex, setAssigningIndex] = useState(null);
  const [creatingIndex, setCreatingIndex] = useState(null);

  function applyExtraction(extraction) {
    if (extraction.status === 'failed') {
      setError(extraction.error || 'Auslesung fehlgeschlagen');
      setState('failed');
      return;
    }
    setMatchedDrafts(extraction.matched.map(draftFromMatch));
    setUnmatchedDrafts(extraction.unmatched.map((u) => ({ originalText: u.originalText })));
    setState('review');
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setState('uploading');
    setError('');
    try {
      const result = await uploadDocumentForExtraction(file, { objectId });
      setUploadId(result.upload.id);
      applyExtraction(result.extraction);
    } catch (err) {
      setError(err?.message || 'Upload fehlgeschlagen');
      setState('failed');
    }
  }

  async function handleRetry() {
    if (!uploadId) return;
    setState('uploading');
    setError('');
    try {
      const result = await retryUpload(uploadId);
      applyExtraction(result.extraction);
    } catch (err) {
      setError(err?.message || 'Erneute Auslesung fehlgeschlagen');
      setState('failed');
    }
  }

  function updateDraft(index, patch) {
    setMatchedDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function moveUnmatchedToMatched(index, catalogItemId, roomAreaId) {
    const row = unmatchedDrafts[index];
    setMatchedDrafts((prev) => [
      ...prev,
      { originalText: row.originalText, catalogItemId, roomAreaId, mode: 'woechentlich', value: '1', bemerkung: '' },
    ]);
    setUnmatchedDrafts((prev) => prev.filter((_, i) => i !== index));
    setAssigningIndex(null);
    setCreatingIndex(null);
  }

  function discardUnmatched(index) {
    setUnmatchedDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  const canSave =
    matchedDrafts.length > 0 && leistungsart.trim() && matchedDrafts.every((d) => d.roomAreaId && d.catalogItemId);

  async function handleSave() {
    setState('saving');
    try {
      const items = matchedDrafts.map((d) => ({
        catalogItemId: d.catalogItemId,
        roomAreaId: d.roomAreaId,
        nachBedarf: d.mode === 'bedarf',
        einmalig: d.mode === 'einmalig',
        woechentlich: d.mode === 'woechentlich' ? Number(d.value) : null,
        monatlich: d.mode === 'monatlich' ? Number(d.value) : null,
        jaehrlich: d.mode === 'jaehrlich' ? Number(d.value) : null,
        bemerkung: d.bemerkung,
      }));
      await createServiceSpec(objectId, { leistungsart, items });
      setState('done');
      onDone();
    } catch (err) {
      alert(err?.message || 'Leistungsverzeichnis konnte nicht gespeichert werden');
      setState('review');
    }
  }

  return (
    <div className="import-box" style={{ marginBottom: 16 }}>
      <div className="modal-subheading">Dokument hochladen und auslesen</div>

      {state === 'idle' && (
        <>
          <p className="modal-hint">
            PDF oder Foto eines bestehenden Leistungsverzeichnisses. Positionen werden dem Katalog zugeordnet - das
            Ergebnis muss hier bestätigt werden, bevor etwas gespeichert wird.
          </p>
          <input type="file" accept="application/pdf,image/*" onChange={handleFileSelected} />
          <div className="modal-actions">
            <button type="button" onClick={onCancel}>
              Abbrechen
            </button>
          </div>
        </>
      )}

      {state === 'uploading' && <p className="modal-hint">Liest aus...</p>}

      {state === 'failed' && (
        <>
          <div className="modal-message error">Auslesung fehlgeschlagen: {error}</div>
          <div className="modal-actions">
            <button type="button" onClick={onCancel}>
              Von Hand erfassen
            </button>
            {uploadId && (
              <button type="button" className="primary" onClick={handleRetry}>
                Erneut versuchen
              </button>
            )}
          </div>
        </>
      )}

      {(state === 'review' || state === 'saving') && (
        <>
          <label className="modal-field">
            Leistungsart
            <input value={leistungsart} onChange={(e) => setLeistungsart(e.target.value)} />
          </label>

          <div className="modal-subheading">Zugeordnete Positionen ({matchedDrafts.length})</div>
          {matchedDrafts.map((d, i) => {
            const cat = localCatalog.find((c) => c.id === d.catalogItemId);
            return (
              <div key={i} className="db-spec-card">
                <div style={{ marginBottom: 6 }}>
                  <strong>{cat ? `${cat.gegenstand} (${cat.verb})` : d.catalogItemId}</strong>
                  <div className="modal-hint">„{d.originalText}"</div>
                </div>
                <div className="modal-field-row">
                  <label className="modal-field">
                    Raumbereich {!d.roomAreaId && <span style={{ color: 'var(--danger)' }}>*</span>}
                    <select value={d.roomAreaId} onChange={(e) => updateDraft(i, { roomAreaId: e.target.value })}>
                      <option value="">Bitte wählen</option>
                      {roomAreas.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="modal-field">
                    Intervall
                    <select value={d.mode} onChange={(e) => updateDraft(i, { mode: e.target.value })}>
                      <option value="woechentlich">Wöchentlich</option>
                      <option value="monatlich">Monatlich</option>
                      <option value="jaehrlich">Jährlich</option>
                      <option value="bedarf">Bei Bedarf</option>
                      <option value="einmalig">Einmalig</option>
                    </select>
                  </label>
                  {!['bedarf', 'einmalig'].includes(d.mode) && (
                    <label className="modal-field">
                      Häufigkeit
                      <input type="number" min="1" value={d.value} onChange={(e) => updateDraft(i, { value: e.target.value })} />
                    </label>
                  )}
                  <label className="modal-field">
                    Bemerkung
                    <input value={d.bemerkung} onChange={(e) => updateDraft(i, { bemerkung: e.target.value })} />
                  </label>
                </div>
              </div>
            );
          })}

          {unmatchedDrafts.length > 0 && (
            <>
              <div className="modal-subheading">Nicht zugeordnet ({unmatchedDrafts.length})</div>
              {unmatchedDrafts.map((u, i) => (
                <div key={i} className="db-spec-card">
                  <div className="modal-hint">„{u.originalText}"</div>
                  {assigningIndex === i ? (
                    <AssignForm
                      catalog={localCatalog}
                      roomAreas={roomAreas}
                      onCancel={() => setAssigningIndex(null)}
                      onAssign={(catalogItemId, roomAreaId) => moveUnmatchedToMatched(i, catalogItemId, roomAreaId)}
                    />
                  ) : creatingIndex === i ? (
                    <CreateCatalogForm
                      roomAreas={roomAreas}
                      onCancel={() => setCreatingIndex(null)}
                      onCreated={(newItem, roomAreaId) => {
                        setLocalCatalog((prev) => [...prev, newItem]);
                        moveUnmatchedToMatched(i, newItem.id, roomAreaId);
                      }}
                    />
                  ) : (
                    <div className="ai-issue-actions">
                      <button type="button" onClick={() => setAssigningIndex(i)}>
                        Zuordnen
                      </button>
                      <button type="button" onClick={() => setCreatingIndex(i)}>
                        Als neuen Katalogpunkt anlegen
                      </button>
                      <button type="button" onClick={() => discardUnmatched(i)}>
                        Verwerfen
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          <div className="modal-actions">
            <button type="button" onClick={onCancel}>
              Abbrechen
            </button>
            <button type="button" className="primary" onClick={handleSave} disabled={!canSave || state === 'saving'}>
              {state === 'saving' ? 'Speichert...' : 'Bestätigen und Leistungsverzeichnis erstellen'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function AssignForm({ catalog, roomAreas, onAssign, onCancel }) {
  const [catalogItemId, setCatalogItemId] = useState('');
  const [roomAreaId, setRoomAreaId] = useState('');
  return (
    <div className="modal-field-row" style={{ marginTop: 8 }}>
      <label className="modal-field">
        Katalogeintrag
        <select value={catalogItemId} onChange={(e) => setCatalogItemId(e.target.value)}>
          <option value="">Bitte wählen</option>
          {catalog.map((c) => (
            <option key={c.id} value={c.id}>
              {c.gegenstand} ({c.verb})
            </option>
          ))}
        </select>
      </label>
      <label className="modal-field">
        Raumbereich
        <select value={roomAreaId} onChange={(e) => setRoomAreaId(e.target.value)}>
          <option value="">Bitte wählen</option>
          {roomAreas.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <div className="modal-actions">
        <button type="button" onClick={onCancel}>
          Abbrechen
        </button>
        <button
          type="button"
          className="primary"
          disabled={!catalogItemId || !roomAreaId}
          onClick={() => onAssign(catalogItemId, roomAreaId)}
        >
          Übernehmen
        </button>
      </div>
    </div>
  );
}

// "Nur ein Mensch legt Katalogpunkte an" - dieses Formular wird ausschließlich
// von hier (menschliche Bestätigung im Review) aufgerufen, nie vom Modell.
function CreateCatalogForm({ roomAreas, onCreated, onCancel }) {
  const [elementGroupId, setElementGroupId] = useState('');
  const [elementGroups, setElementGroups] = useState(null);
  const [gegenstand, setGegenstand] = useState('');
  const [verb, setVerb] = useState(VERBS[0]);
  const [zusatz, setZusatz] = useState('');
  const [roomAreaId, setRoomAreaId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listElementGroups().then(setElementGroups);
  }, []);

  async function handleCreate() {
    setSaving(true);
    try {
      const item = await createCatalogItem({ elementGroupId, gegenstand, verb, zusatz });
      onCreated(item, roomAreaId);
    } catch (err) {
      alert(err?.message || 'Katalogpunkt konnte nicht angelegt werden');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div className="modal-field-row">
        <label className="modal-field">
          Elementgruppe
          <select value={elementGroupId} onChange={(e) => setElementGroupId(e.target.value)}>
            <option value="">Bitte wählen</option>
            {(elementGroups || []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="modal-field">
          Gegenstand
          <input value={gegenstand} onChange={(e) => setGegenstand(e.target.value)} />
        </label>
        <label className="modal-field">
          Verb
          <select value={verb} onChange={(e) => setVerb(e.target.value)}>
            {VERBS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="modal-field-row">
        <label className="modal-field">
          Zusatz (optional)
          <input value={zusatz} onChange={(e) => setZusatz(e.target.value)} />
        </label>
        <label className="modal-field">
          Raumbereich
          <select value={roomAreaId} onChange={(e) => setRoomAreaId(e.target.value)}>
            <option value="">Bitte wählen</option>
            {roomAreas.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="modal-actions">
        <button type="button" onClick={onCancel}>
          Abbrechen
        </button>
        <button
          type="button"
          className="primary"
          disabled={!elementGroupId || !gegenstand.trim() || !roomAreaId || saving}
          onClick={handleCreate}
        >
          Anlegen und übernehmen
        </button>
      </div>
    </div>
  );
}

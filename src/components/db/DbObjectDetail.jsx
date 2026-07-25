import React, { useEffect, useState } from 'react';
import {
  getDbObject,
  listDbObjects,
  listRoomAreas,
  listCatalog,
  listServiceSpecs,
  createServiceSpec,
  transferServiceSpec,
} from '../../lib/dbCrm.js';

function IntervalSummary({ item }) {
  if (item.nachBedarf) return <span className="lv-interval-chip">Bei Bedarf</span>;
  if (item.woechentlich) return <span className="lv-interval-chip">{item.woechentlich}x wöchentlich</span>;
  if (item.monatlich) return <span className="lv-interval-chip">{item.monatlich}x monatlich</span>;
  if (item.jaehrlich) return <span className="lv-interval-chip">{item.jaehrlich}x jährlich</span>;
  return null;
}

export default function DbObjectDetail({ objectId, onBack }) {
  const [object, setObject] = useState(null);
  const [siblings, setSiblings] = useState([]);
  const [specs, setSpecs] = useState([]);
  const [roomAreas, setRoomAreas] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const [showNewSpec, setShowNewSpec] = useState(false);
  const [leistungsart, setLeistungsart] = useState('Unterhaltsreinigung');
  const [draftItems, setDraftItems] = useState([]);
  const [newItem, setNewItem] = useState({ roomAreaId: '', catalogItemId: '', mode: 'woechentlich', value: '1', bemerkung: '' });

  const [transferSpecId, setTransferSpecId] = useState(null);
  const [transferTargets, setTransferTargets] = useState([]);
  const [transferStatus, setTransferStatus] = useState('idle');

  function load() {
    setStatus('loading');
    Promise.all([getDbObject(objectId), listServiceSpecs(objectId), listRoomAreas(), listCatalog()])
      .then(([obj, specList, areas, cat]) => {
        setObject(obj);
        setSpecs(specList);
        setRoomAreas(areas);
        setCatalog(cat);
        setStatus('done');
        return listDbObjects(obj.customerId).then((all) => setSiblings(all.filter((o) => o.id !== objectId)));
      })
      .catch((err) => {
        setError(err?.message || 'Fehler beim Laden');
        setStatus('error');
      });
  }

  useEffect(load, [objectId]);

  function addDraftItem() {
    if (!newItem.roomAreaId || !newItem.catalogItemId) return;
    const item = {
      roomAreaId: newItem.roomAreaId,
      catalogItemId: newItem.catalogItemId,
      bemerkung: newItem.bemerkung,
      nachBedarf: newItem.mode === 'bedarf',
      woechentlich: newItem.mode === 'woechentlich' ? Number(newItem.value) : null,
      monatlich: newItem.mode === 'monatlich' ? Number(newItem.value) : null,
      jaehrlich: newItem.mode === 'jaehrlich' ? Number(newItem.value) : null,
    };
    setDraftItems((prev) => [...prev, item]);
    setNewItem({ roomAreaId: '', catalogItemId: '', mode: 'woechentlich', value: '1', bemerkung: '' });
  }

  async function handleSaveSpec() {
    if (draftItems.length === 0) return;
    try {
      await createServiceSpec(objectId, { leistungsart, items: draftItems });
      setDraftItems([]);
      setShowNewSpec(false);
      load();
    } catch (err) {
      alert(err?.message || 'Leistungsverzeichnis konnte nicht gespeichert werden');
    }
  }

  function toggleTransferTarget(id) {
    setTransferTargets((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleTransfer() {
    setTransferStatus('running');
    try {
      await transferServiceSpec(transferSpecId, transferTargets);
      setTransferStatus('done');
      setTimeout(() => {
        setTransferSpecId(null);
        setTransferTargets([]);
        setTransferStatus('idle');
      }, 1500);
    } catch (err) {
      setTransferStatus('error');
      alert(err?.message || 'Übertragung fehlgeschlagen');
    }
  }

  if (status === 'loading') return <div className="overview-page"><p className="modal-hint">Lädt...</p></div>;
  if (status === 'error') return <div className="overview-page"><div className="modal-message error">{error}</div></div>;

  return (
    <div className="overview-page">
      <div className="overview-page-card">
        <h2>{object.label}</h2>
        <p className="modal-hint">
          {object.street}, {object.zip} {object.city}
          {object.contactPersonOnSite ? ` · Ansprechpartner vor Ort: ${object.contactPersonOnSite}` : ''}
        </p>

        <div className="overview-actions">
          <button onClick={onBack}>Zurück</button>
          <button onClick={() => setShowNewSpec((v) => !v)}>+ Leistungsverzeichnis erstellen</button>
        </div>

        {showNewSpec && (
          <div className="import-box" style={{ marginBottom: 16 }}>
            <label className="modal-field">
              Leistungsart
              <input value={leistungsart} onChange={(e) => setLeistungsart(e.target.value)} />
            </label>

            <div className="modal-subheading">Position hinzufügen</div>
            <div className="modal-field-row">
              <label className="modal-field">
                Raumbereich
                <select value={newItem.roomAreaId} onChange={(e) => setNewItem((v) => ({ ...v, roomAreaId: e.target.value }))}>
                  <option value="">Bitte wählen</option>
                  {roomAreas.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="modal-field">
                Katalogeintrag
                <select
                  value={newItem.catalogItemId}
                  onChange={(e) => setNewItem((v) => ({ ...v, catalogItemId: e.target.value }))}
                >
                  <option value="">Bitte wählen</option>
                  {catalog.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.elementGroup?.name}: {c.gegenstand} ({c.verb})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="modal-field-row">
              <label className="modal-field">
                Intervall
                <select value={newItem.mode} onChange={(e) => setNewItem((v) => ({ ...v, mode: e.target.value }))}>
                  <option value="woechentlich">Wöchentlich</option>
                  <option value="monatlich">Monatlich</option>
                  <option value="jaehrlich">Jährlich</option>
                  <option value="bedarf">Bei Bedarf</option>
                </select>
              </label>
              {newItem.mode !== 'bedarf' && (
                <label className="modal-field">
                  Häufigkeit
                  <input
                    type="number"
                    min="1"
                    value={newItem.value}
                    onChange={(e) => setNewItem((v) => ({ ...v, value: e.target.value }))}
                  />
                </label>
              )}
              <label className="modal-field">
                Bemerkung (nur Rhythmus/Bedingung)
                <input value={newItem.bemerkung} onChange={(e) => setNewItem((v) => ({ ...v, bemerkung: e.target.value }))} />
              </label>
            </div>
            <button type="button" onClick={addDraftItem}>
              + Position übernehmen
            </button>

            {draftItems.length > 0 && (
              <ul style={{ marginTop: 12 }}>
                {draftItems.map((it, i) => {
                  const cat = catalog.find((c) => c.id === it.catalogItemId);
                  const area = roomAreas.find((r) => r.id === it.roomAreaId);
                  return (
                    <li key={i}>
                      {area?.name} – {cat?.gegenstand} ({cat?.verb})
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="modal-actions">
              <button type="button" onClick={() => setShowNewSpec(false)}>
                Abbrechen
              </button>
              <button type="button" className="primary" onClick={handleSaveSpec} disabled={draftItems.length === 0}>
                Leistungsverzeichnis speichern
              </button>
            </div>
          </div>
        )}

        <div className="modal-subheading" style={{ marginTop: 16 }}>
          Leistungsverzeichnisse
        </div>
        {specs.length === 0 && <p className="modal-hint">Noch kein Leistungsverzeichnis für dieses Objekt.</p>}
        {specs.map((spec) => (
          <div key={spec.id} className="db-spec-card">
            <div className="ai-issue-header">
              {spec.leistungsart} · Version {spec.version}
            </div>
            <ul>
              {spec.items.map((item) => (
                <li key={item.id}>
                  {item.roomArea?.name} – {item.catalogItem?.gegenstand} ({item.catalogItem?.verb}) <IntervalSummary item={item} />
                  {item.bemerkung ? ` · ${item.bemerkung}` : ''}
                </li>
              ))}
            </ul>

            {transferSpecId === spec.id ? (
              <div className="import-box">
                <div className="modal-subheading">Auf andere Objekte übertragen</div>
                {siblings.length === 0 && <p className="modal-hint">Dieser Kunde hat keine weiteren Objekte.</p>}
                <div className="quick-setup-checkbox-list">
                  {siblings.map((s) => (
                    <label key={s.id} className="quick-setup-checkbox">
                      <input
                        type="checkbox"
                        checked={transferTargets.includes(s.id)}
                        onChange={() => toggleTransferTarget(s.id)}
                      />
                      {s.label} ({s.street})
                    </label>
                  ))}
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setTransferSpecId(null);
                      setTransferTargets([]);
                    }}
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    className="primary"
                    onClick={handleTransfer}
                    disabled={transferTargets.length === 0 || transferStatus === 'running'}
                  >
                    {transferStatus === 'running'
                      ? 'Überträgt...'
                      : transferStatus === 'done'
                        ? '✓ Übertragen'
                        : `Auf ${transferTargets.length || ''} Objekt(e) übertragen`}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setTransferSpecId(spec.id)}>
                Auf andere Objekte übertragen
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

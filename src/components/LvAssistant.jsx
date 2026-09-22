import React, { useEffect, useRef, useState } from 'react';
import { AREA_DEFINITIONS, AREA_ORDER } from '../templates/checklistAreas.js';
import { TASK_SUGGESTIONS } from '../templates/suggestions.js';
import { applyAktionen, describeAktion } from '../lib/lvActions.js';
import DiktatButton from './DiktatButton.jsx';

// Der Assistent ändert nie direkt etwas am Leistungsverzeichnis. Er schlägt
// vor, zeigt die Vorschläge im Klartext, und erst ein Klick auf "Übernehmen"
// wendet sie an. Rückgängig geht über den bestehenden Undo-Weg (der
// Schnappschuss wird vorher gesichert).
export default function LvAssistant({ sections, setSections, lvTitle, setLvTitle, objekt, onClose }) {
  const [eingabe, setEingabe] = useState('');
  const [verlauf, setVerlauf] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | denkt | fehler
  const [fehler, setFehler] = useState('');
  const [offeneVorschlaege, setOffeneVorschlaege] = useState(null);
  const [letzterSnapshot, setLetzterSnapshot] = useState(null);

  const eingabeRef = useRef(null);

  useEffect(() => {
    eingabeRef.current?.focus();
  }, []);

  function katalogKontext() {
    return {
      katalogTexte: TASK_SUGGESTIONS,
      areaListe: AREA_ORDER.map((key) => ({ key, label: AREA_DEFINITIONS[key].label })),
    };
  }

  async function frageAssistent(nachricht) {
    if (!nachricht.trim()) return;
    setStatus('denkt');
    setFehler('');
    setVerlauf((v) => [...v, { rolle: 'ich', text: nachricht }]);
    setEingabe('');
    try {
      const res = await fetch('/api/lv/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nachricht, sections, lvTitle, objekt, ...katalogKontext() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) throw new Error(data?.error || 'Unbekannter Fehler');
      setVerlauf((v) => [...v, { rolle: 'assistent', text: data.antwort || '', anzahl: data.aktionen?.length || 0 }]);
      setOffeneVorschlaege(data.aktionen?.length ? data.aktionen : null);
      setStatus('idle');
    } catch (err) {
      setFehler(err?.message || 'Unbekannter Fehler');
      setStatus('fehler');
    }
  }

  function uebernehmen() {
    if (!offeneVorschlaege) return;
    setLetzterSnapshot({ sections, lvTitle });
    const meta = {};
    const neu = applyAktionen(sections, offeneVorschlaege, meta);
    setSections(neu);
    if (meta.lvTitle && setLvTitle) setLvTitle(meta.lvTitle);
    setVerlauf((v) => [
      ...v,
      { rolle: 'system', text: `${offeneVorschlaege.length} Änderung(en) übernommen.` },
    ]);
    setOffeneVorschlaege(null);
  }

  function verwerfen() {
    setOffeneVorschlaege(null);
    setVerlauf((v) => [...v, { rolle: 'system', text: 'Vorschläge verworfen.' }]);
  }

  function rueckgaengig() {
    if (!letzterSnapshot) return;
    setSections(letzterSnapshot.sections);
    if (setLvTitle) setLvTitle(letzterSnapshot.lvTitle);
    setLetzterSnapshot(null);
    setVerlauf((v) => [...v, { rolle: 'system', text: 'Letzte Übernahme rückgängig gemacht.' }]);
  }

  const beschaeftigt = status === 'denkt';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal lv-assistant-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-modal-header">
          <h2>Assistent</h2>
          {letzterSnapshot && (
            <button type="button" className="ai-undo-btn" onClick={rueckgaengig}>
              ↺ Rückgängig
            </button>
          )}
        </div>

        <p className="modal-hint">
          Sag oder schreib, was geändert werden soll — zum Beispiel „Sanitär auf dreimal die Woche",
          „nimm den Aufzug raus" oder „füge Küchenräume hinzu". Änderungen werden erst nach deiner
          Bestätigung übernommen.
        </p>

        <div className="lv-assistant-verlauf">
          {verlauf.length === 0 && <p className="modal-hint">Noch nichts besprochen.</p>}
          {verlauf.map((eintrag, i) => (
            <div key={i} className={`lv-assistant-zeile lv-assistant-${eintrag.rolle}`}>
              {eintrag.text}
            </div>
          ))}
          {status === 'denkt' && <div className="lv-assistant-zeile lv-assistant-system">Denkt nach…</div>}
        </div>

        {offeneVorschlaege && (
          <div className="lv-assistant-vorschlaege">
            <div className="lv-assistant-vorschlaege-head">Vorgeschlagene Änderungen</div>
            <ul>
              {offeneVorschlaege.map((a, i) => (
                <li key={i}>{describeAktion(a)}</li>
              ))}
            </ul>
            <div className="lv-assistant-vorschlaege-actions">
              <button type="button" className="ai-btn-apply" onClick={uebernehmen}>
                Übernehmen
              </button>
              <button type="button" onClick={verwerfen}>
                Verwerfen
              </button>
            </div>
          </div>
        )}

        {fehler && <div className="modal-message error">{fehler}</div>}

        <div className="lv-assistant-eingabe">
          <DiktatButton
            disabled={beschaeftigt}
            onFehler={(m) => setFehler(m)}
            onTranskript={(text) => {
              // Erst ins Eingabefeld, damit vor dem Abschicken korrigiert
              // werden kann.
              setFehler('');
              setEingabe(text);
              eingabeRef.current?.focus();
            }}
          />
          <input
            ref={eingabeRef}
            type="text"
            value={eingabe}
            onChange={(e) => setEingabe(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !beschaeftigt) frageAssistent(eingabe);
            }}
            placeholder="Was soll geändert werden?"
            disabled={beschaeftigt}
          />
          <button type="button" onClick={() => frageAssistent(eingabe)} disabled={beschaeftigt || !eingabe.trim()}>
            Senden
          </button>
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { TASK_CATEGORIES } from '../templates/inspectionTasks.js';

const WOECHENTLICH_VALUES = ['1x', '2x', '3x', '4x', '5x', '6x', '7x'];
const MONATLICH_VALUES = ['1x', '2x', '3x', '4x'];

function newTaskRow(text) {
  return {
    id: `insp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    bedarf: false,
    intervalColumn: '',
    intervalValue: '',
    bemerkung: '',
  };
}

export default function InspectionMode({ sections, setSections, onClose }) {
  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id || '');
  const [addToAll, setAddToAll] = useState({}); // taskText -> bool

  const activeSection = sections.find((s) => s.id === activeSectionId);

  function sectionHasTask(sectionId, text) {
    const s = sections.find((sec) => sec.id === sectionId);
    return !!s?.rows.some((r) => r.text === text);
  }

  function toggleTask(text) {
    if (!activeSectionId) return;
    const has = sectionHasTask(activeSectionId, text);
    if (has) {
      setSections((prev) =>
        prev.map((s) => (s.id === activeSectionId ? { ...s, rows: s.rows.filter((r) => r.text !== text) } : s))
      );
    } else if (addToAll[text]) {
      setSections((prev) =>
        prev.map((s) => (s.rows.some((r) => r.text === text) ? s : { ...s, rows: [newTaskRow(text), ...s.rows] }))
      );
    } else {
      setSections((prev) =>
        prev.map((s) => (s.id === activeSectionId ? { ...s, rows: [newTaskRow(text), ...s.rows] } : s))
      );
    }
  }

  function removeTaskFromSection(sectionId, text) {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, rows: s.rows.filter((r) => r.text !== text) } : s))
    );
  }

  function toggleAddToAll(text, checked) {
    setAddToAll((prev) => ({ ...prev, [text]: checked }));
    if (checked) {
      setSections((prev) =>
        prev.map((s) => (s.rows.some((r) => r.text === text) ? s : { ...s, rows: [newTaskRow(text), ...s.rows] }))
      );
    }
  }

  function setIntervalForTask(text, patch) {
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        rows: s.rows.map((r) => (r.text === text ? { ...r, ...patch } : r)),
      }))
    );
  }

  const activeTasks = activeSection ? activeSection.rows.map((r) => r.text).filter(Boolean) : [];

  return (
    <div className="inspection-overlay">
      <div className="inspection-topbar">
        <h2>Besichtigungsmodus</h2>
        <label className="inspection-section-select">
          Aktiver Bereich
          <select value={activeSectionId} onChange={(e) => setActiveSectionId(e.target.value)}>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <button className="inspection-close" onClick={onClose}>
          Fertig
        </button>
      </div>

      <div className="inspection-body">
        <div className="inspection-left">
          {TASK_CATEGORIES.map((cat) => (
            <div key={cat.name} className="inspection-category">
              <div className="inspection-category-title">{cat.name}</div>
              <div className="inspection-tiles">
                {cat.tasks.map((task) => {
                  const active = activeSectionId && sectionHasTask(activeSectionId, task);
                  return (
                    <button
                      key={task}
                      className={`inspection-tile${active ? ' selected' : ''}`}
                      onClick={() => toggleTask(task)}
                    >
                      {task}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="inspection-right">
          <div className="inspection-right-title">
            Ausgewählte Leistungen{activeSection ? ` – ${activeSection.title}` : ''}
          </div>
          {activeTasks.length === 0 && (
            <div className="inspection-empty">Noch keine Leistung ausgewählt. Links auf eine Kachel klicken.</div>
          )}
          {activeTasks.map((text) => {
            const row = activeSection.rows.find((r) => r.text === text);
            return (
              <div key={text} className="inspection-task-card">
                <div className="inspection-task-header">
                  <span>{text}</span>
                  <button className="icon-btn" onClick={() => removeTaskFromSection(activeSectionId, text)}>
                    ✕
                  </button>
                </div>
                <div className="inspection-quickrow">
                  <span className="inspection-quicklabel">Wöchentlich</span>
                  {WOECHENTLICH_VALUES.map((v) => (
                    <button
                      key={v}
                      className={`quickbtn${row.intervalColumn === 'woechentlich' && row.intervalValue === v ? ' active' : ''}`}
                      onClick={() =>
                        setIntervalForTask(text, { bedarf: false, intervalColumn: 'woechentlich', intervalValue: v })
                      }
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <div className="inspection-quickrow">
                  <span className="inspection-quicklabel">Monatlich</span>
                  {MONATLICH_VALUES.map((v) => (
                    <button
                      key={v}
                      className={`quickbtn${row.intervalColumn === 'monatlich' && row.intervalValue === v ? ' active' : ''}`}
                      onClick={() =>
                        setIntervalForTask(text, { bedarf: false, intervalColumn: 'monatlich', intervalValue: v })
                      }
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <div className="inspection-quickrow">
                  <span className="inspection-quicklabel">Bei Bedarf</span>
                  <button
                    className={`quickbtn${row.bedarf ? ' active' : ''}`}
                    onClick={() => setIntervalForTask(text, { bedarf: !row.bedarf, intervalColumn: '', intervalValue: '' })}
                  >
                    ✓
                  </button>
                </div>
                <label className="inspection-all-toggle">
                  <input
                    type="checkbox"
                    checked={!!addToAll[text]}
                    onChange={(e) => toggleAddToAll(text, e.target.checked)}
                  />
                  In allen Bereichen hinzufügen
                </label>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

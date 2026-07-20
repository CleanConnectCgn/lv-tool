import React, { useState } from 'react';
import { TASK_CATEGORIES } from '../templates/inspectionTasks.js';
import { CLEAN_CONNECT_LOGO_BASE64 } from '../assets/logo.js';

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
  const [onlyCurrent, setOnlyCurrent] = useState({}); // taskText -> bool, default false = add to all sections

  const activeSection = sections.find((s) => s.id === activeSectionId);

  function sectionHasTask(sectionId, text) {
    const s = sections.find((sec) => sec.id === sectionId);
    return !!s?.rows.some((r) => r.text === text);
  }

  // Ensures the task exists as a row in the appropriate section(s) — active
  // section only if "Nur in diesem Bereich" is set for this task, otherwise
  // in every section that doesn't already have it.
  function ensureTaskSelected(text) {
    if (!activeSectionId) return;
    setSections((prev) => {
      const restrict = onlyCurrent[text];
      if (restrict) {
        return prev.map((s) =>
          s.id === activeSectionId && !s.rows.some((r) => r.text === text)
            ? { ...s, rows: [newTaskRow(text), ...s.rows] }
            : s
        );
      }
      return prev.map((s) => (s.rows.some((r) => r.text === text) ? s : { ...s, rows: [newTaskRow(text), ...s.rows] }));
    });
  }

  function removeFromActiveSection(text) {
    setSections((prev) =>
      prev.map((s) => (s.id === activeSectionId ? { ...s, rows: s.rows.filter((r) => r.text !== text) } : s))
    );
  }

  function togglePill(text) {
    if (sectionHasTask(activeSectionId, text)) {
      removeFromActiveSection(text);
    } else {
      ensureTaskSelected(text);
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

  function handleQuickButton(text, patch) {
    if (!sectionHasTask(activeSectionId, text)) {
      ensureTaskSelected(text);
    }
    setIntervalForTask(text, patch);
  }

  function toggleOnlyCurrent(text, checked) {
    setOnlyCurrent((prev) => ({ ...prev, [text]: checked }));
  }

  return (
    <div className="inspection-overlay">
      <div className="inspection-topbar">
        <img src={CLEAN_CONNECT_LOGO_BASE64} alt="Clean Connect" className="inspection-logo" />
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

      <div className="inspection-body inspection-body-single">
        {TASK_CATEGORIES.map((cat) => (
          <div key={cat.name} className="inspection-category">
            <div className="inspection-category-title">{cat.name}</div>
            <div className="inspection-tiles">
              {cat.tasks.map((task) => {
                const selected = activeSectionId && sectionHasTask(activeSectionId, task);
                const row = activeSection?.rows.find((r) => r.text === task);
                return (
                  <div key={task} className={`inspection-unit${selected ? ' selected' : ''}`}>
                    <button
                      className={`inspection-tile${selected ? ' selected' : ''}`}
                      onClick={() => togglePill(task)}
                    >
                      {task}
                    </button>
                    {selected && row && (
                      <div className="inspection-inline-controls">
                        <div className="inspection-quickrow">
                          <span className="inspection-quicklabel">Wöchentlich</span>
                          {WOECHENTLICH_VALUES.map((v) => (
                            <button
                              key={v}
                              className={`quickbtn${row.intervalColumn === 'woechentlich' && row.intervalValue === v ? ' active' : ''}`}
                              onClick={() =>
                                handleQuickButton(task, { bedarf: false, intervalColumn: 'woechentlich', intervalValue: v })
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
                                handleQuickButton(task, { bedarf: false, intervalColumn: 'monatlich', intervalValue: v })
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
                            onClick={() =>
                              handleQuickButton(task, {
                                bedarf: !row.bedarf,
                                intervalColumn: '',
                                intervalValue: '',
                              })
                            }
                          >
                            ✓
                          </button>
                        </div>
                        <label className="inspection-all-toggle">
                          <input
                            type="checkbox"
                            checked={!!onlyCurrent[task]}
                            onChange={(e) => toggleOnlyCurrent(task, e.target.checked)}
                          />
                          Nur in diesem Bereich
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

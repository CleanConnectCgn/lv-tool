import React, { useMemo, useState } from 'react';
import { TASK_CATEGORIES } from '../templates/inspectionTasks.js';
import { LOGO_URI } from '../assets/logo.js';
import WeekdaySelector, { weekdaysLabel } from './WeekdaySelector.jsx';

const WOECHENTLICH_VALUES = ['1x', '2x', '3x', '4x', '5x', '6x', '7x'];
const MONATLICH_VALUES = ['1x', '2x', '3x', '4x'];

let taskIdCounter = 1;
const nextTaskId = () => `t${taskIdCounter++}-${Math.random().toString(36).slice(2, 6)}`;

function buildInitialTasks() {
  const tasks = [];
  TASK_CATEGORIES.forEach((cat) => {
    cat.tasks.forEach((label) => {
      tasks.push({
        id: nextTaskId(),
        label,
        cat: cat.name,
        selected: false,
        col: '',
        val: '',
        bedarf: false,
        note: '',
        noteForAll: false,
        wochentage: [],
      });
    });
  });
  return tasks;
}

function newRowFromTask(task) {
  return {
    id: `insp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: task.label,
    bedarf: task.bedarf,
    intervalColumn: task.bedarf ? '' : task.col,
    intervalValue: task.bedarf ? '' : task.val,
    bemerkung: task.note || '',
    wochentage: task.col === 'woechentlich' ? task.wochentage || [] : [],
  };
}

export default function InspectionMode({ sections, setSections, internalNotes, setInternalNotes, onClose }) {
  const [tasks, setTasks] = useState(buildInitialTasks);
  // Bereichs-Tiles: welche Bereiche sind für diese Besichtigung aktiv
  // (bekommen die ausgewählten Leistungen). Standardmäßig alle aktiv.
  const [activeSectionIds, setActiveSectionIds] = useState(() => new Set(sections.map((s) => s.id)));
  const [sectionNotes, setSectionNotes] = useState({});
  const [activeCat, setActiveCat] = useState('Alle');
  const [focusedTaskId, setFocusedTaskId] = useState(null);
  const [newLabel, setNewLabel] = useState('');
  const [newCat, setNewCat] = useState(TASK_CATEGORIES[0]?.name || '');
  const [globalWeekdays, setGlobalWeekdays] = useState([]);
  const [focusedSectionId, setFocusedSectionId] = useState(null);

  function toggleSectionActive(id) {
    setActiveSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const activeSectionsCount = activeSectionIds.size;
  const selectedCount = tasks.filter((t) => t.selected).length;
  const focusedTask = tasks.find((t) => t.id === focusedTaskId);

  function patchTask(id, patch) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function toggleSelected(id) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t)));
    setFocusedTaskId(id);
  }

  function handleQuickButton(id, patch) {
    patchTask(id, { ...patch, selected: true });
    setFocusedTaskId(id);
  }

  // Übernimmt die global gewählten Wochentage auf alle bereits als
  // "wöchentlich" markierten Tasks (Schnellsynchronisation).
  function applyGlobalWeekdays(days) {
    setGlobalWeekdays(days);
    setTasks((prev) =>
      prev.map((t) =>
        t.selected && t.col === 'woechentlich'
          ? { ...t, wochentage: days, val: days.length > 0 ? `${days.length}x` : t.val }
          : t
      )
    );
  }

  function addNewTask() {
    const label = newLabel.trim();
    if (!label) return;
    const task = {
      id: nextTaskId(),
      label,
      cat: newCat,
      selected: false,
      col: '',
      val: '',
      bedarf: false,
      note: '',
      noteForAll: false,
    };
    setTasks((prev) => [...prev, task]);
    setNewLabel('');
  }

  function handleFinish() {
    const selectedTasks = tasks.filter((t) => t.selected);
    setSections((prev) =>
      prev.map((s) => {
        if (!activeSectionIds.has(s.id)) return s;
        const newRows = selectedTasks.map((t) => newRowFromTask(t));
        const note = sectionNotes[s.id]?.trim();
        if (note) {
          newRows.push({
            id: `insp-note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            text: note,
            bedarf: true,
            intervalColumn: '',
            intervalValue: '',
            bemerkung: '',
            wochentage: [],
          });
        }
        if (newRows.length === 0) return s;
        return { ...s, rows: [...newRows, ...s.rows] };
      })
    );
    onClose();
  }

  const categoryNames = useMemo(() => ['Alle', ...TASK_CATEGORIES.map((c) => c.name)], []);

  const visibleTasks = tasks.filter((t) => activeCat === 'Alle' || t.cat === activeCat);
  const selectedTasks = visibleTasks.filter((t) => t.selected);
  const availableTasks = visibleTasks.filter((t) => !t.selected);

  function TaskRow({ task }) {
    return (
      <div
        className={`inspection-task-row${task.selected ? ' selected' : ''}`}
        onClick={() => setFocusedTaskId(task.id)}
      >
        <button
          type="button"
          className={`inspection-task-checkbox${task.selected ? ' on' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleSelected(task.id);
          }}
        >
          {task.selected ? '✓' : ''}
        </button>
        <input
          className="inspection-task-label"
          value={task.label}
          onChange={(e) => patchTask(task.id, { label: e.target.value })}
        />
        <div className="inspection-quick-group">
          <span className="inspection-quick-group-label">Wöchentlich</span>
          {WOECHENTLICH_VALUES.map((v) => (
            <button
              key={v}
              type="button"
              className={`quickbtn${task.col === 'woechentlich' && task.val === v ? ' active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleQuickButton(task.id, { bedarf: false, col: 'woechentlich', val: v });
              }}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="inspection-quick-sep" />
        <div className="inspection-quick-group">
          <span className="inspection-quick-group-label">Monatlich</span>
          {MONATLICH_VALUES.map((v) => (
            <button
              key={v}
              type="button"
              className={`quickbtn${task.col === 'monatlich' && task.val === v ? ' active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleQuickButton(task.id, { bedarf: false, col: 'monatlich', val: v });
              }}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="inspection-quick-sep" />
        <button
          type="button"
          className={`quickbtn${task.bedarf ? ' active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            handleQuickButton(task.id, { bedarf: !task.bedarf, col: '', val: '' });
          }}
        >
          Bei Bedarf
        </button>
        {task.col === 'woechentlich' && task.wochentage?.length > 0 && (
          <span className="inspection-weekday-badge">{weekdaysLabel(task.wochentage)}</span>
        )}
      </div>
    );
  }

  return (
    <div className="inspection-overlay">
      <div className="inspection-topbar">
        <img src={LOGO_URI} alt="Clean Connect" className="inspection-logo" />
        <h2>Besichtigungsmodus</h2>
        <span className="inspection-count-badge">{selectedCount} ausgewählt</span>
        <button className="inspection-close" onClick={handleFinish}>
          Fertig ✓
        </button>
      </div>

      <div className="inspection-body">
        <div className="inspection-left">
          <div className="inspection-section-tiles">
            <span className="inspection-global-sync-label">
              Bereiche für diese Besichtigung ({activeSectionsCount}/{sections.length} aktiv):
            </span>
            <div className="inspection-tile-row">
              {sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`inspection-section-tile${activeSectionIds.has(s.id) ? ' active' : ''}`}
                  onClick={() => toggleSectionActive(s.id)}
                  onDoubleClick={() => setFocusedSectionId(s.id)}
                  title="Klick: aktivieren/deaktivieren · Doppelklick: Schnellnotiz"
                >
                  {s.title}
                </button>
              ))}
            </div>
            {focusedSectionId && sections.some((s) => s.id === focusedSectionId) && (
              <div className="inspection-section-note">
                <span className="inspection-detail-subheading">
                  Schnellnotiz — {sections.find((s) => s.id === focusedSectionId)?.title}
                </span>
                <textarea
                  className="inspection-note-textarea"
                  value={sectionNotes[focusedSectionId] || ''}
                  onChange={(e) =>
                    setSectionNotes((prev) => ({ ...prev, [focusedSectionId]: e.target.value }))
                  }
                  placeholder="Besonderheiten für diesen Bereich..."
                />
                <button type="button" className="inspection-note-close" onClick={() => setFocusedSectionId(null)}>
                  Schließen
                </button>
              </div>
            )}
          </div>
          <div className="inspection-global-sync">
            <span className="inspection-global-sync-label">Alle Bereiche wöchentlich:</span>
            <WeekdaySelector compact value={globalWeekdays} onChange={applyGlobalWeekdays} />
          </div>
          <div className="inspection-cat-chips">
            {categoryNames.map((name) => (
              <button
                key={name}
                type="button"
                className={`inspection-cat-chip${activeCat === name ? ' active' : ''}`}
                onClick={() => setActiveCat(name)}
              >
                {name}
              </button>
            ))}
          </div>

          {selectedTasks.length > 0 && (
            <>
              <div className="inspection-list-heading">Ausgewählt ({selectedTasks.length})</div>
              {selectedTasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </>
          )}

          <div className="inspection-list-heading">Verfügbar</div>
          {availableTasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}

          <div className="inspection-add-row">
            <select value={newCat} onChange={(e) => setNewCat(e.target.value)}>
              {TASK_CATEGORIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addNewTask();
              }}
              onBlur={addNewTask}
              placeholder="Leistung eingeben..."
            />
            <button type="button" onClick={addNewTask}>
              +
            </button>
          </div>
        </div>

        <div className="inspection-right">
          <div className="inspection-detail-heading">
            {focusedTask ? focusedTask.label : 'Notizen zum Objekt'}
          </div>

          {focusedTask ? (
            <>
              {focusedTask.selected && (
                <div className="inspection-detail-badge">
                  Wird zu {activeSectionsCount} aktiven Bereich{activeSectionsCount === 1 ? '' : 'en'} hinzugefügt
                </div>
              )}
              {focusedTask.col === 'woechentlich' && (
                <div className="inspection-weekday-block">
                  <span className="inspection-detail-subheading">Wochentage</span>
                  <WeekdaySelector
                    compact
                    value={focusedTask.wochentage || []}
                    onChange={(wochentage) =>
                      // Wochentage anklicken passte das Wöchentlich-Intervall
                      // vorher nicht an (analog zu RowEditor.jsx) - jetzt
                      // synchron, solange mindestens ein Tag ausgewählt ist.
                      patchTask(focusedTask.id, {
                        wochentage,
                        val: wochentage.length > 0 ? `${wochentage.length}x` : focusedTask.val,
                      })
                    }
                  />
                </div>
              )}
              <textarea
                className="inspection-note-textarea"
                value={focusedTask.note}
                onChange={(e) => {
                  const value = e.target.value;
                  if (focusedTask.noteForAll) {
                    // Notiz auf alle ausgewählten Leistungen übertragen, nicht
                    // nur auf die gerade fokussierte - die Checkbox war zuvor
                    // wirkungslos (gesetzt, aber nie ausgewertet).
                    setTasks((prev) => prev.map((t) => (t.selected ? { ...t, note: value } : t)));
                  } else {
                    patchTask(focusedTask.id, { note: value });
                  }
                }}
                placeholder="Anmerkungen zu dieser Leistung..."
              />
              <label className="inspection-note-toggle">
                <input
                  type="checkbox"
                  checked={focusedTask.noteForAll}
                  onChange={(e) => patchTask(focusedTask.id, { noteForAll: e.target.checked })}
                />
                Notiz für alle ausgewählten Leistungen übernehmen
              </label>
            </>
          ) : (
            <p className="modal-hint">Wähle links eine Leistung aus, um Notizen zu hinterlegen.</p>
          )}

          <hr className="inspection-right-divider" />

          <div className="inspection-detail-heading">Objekt Notizen</div>
          <textarea
            className="inspection-note-textarea"
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            placeholder="Allgemeine Anmerkungen zur Besichtigung (intern, wird nicht im LV angezeigt, aber mit gespeichert)..."
          />
        </div>
      </div>
    </div>
  );
}

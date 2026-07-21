import React, { useMemo, useState } from 'react';
import { TASK_CATEGORIES } from '../templates/inspectionTasks.js';
import { LOGO_URI } from '../assets/logo.js';

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
  };
}

export default function InspectionMode({ sections, setSections, onClose }) {
  const [tasks, setTasks] = useState(buildInitialTasks);
  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id || '');
  const [activeCat, setActiveCat] = useState('Alle');
  const [focusedTaskId, setFocusedTaskId] = useState(null);
  const [objektNotizen, setObjektNotizen] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newCat, setNewCat] = useState(TASK_CATEGORIES[0]?.name || '');

  const activeSection = sections.find((s) => s.id === activeSectionId);
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
    if (selectedTasks.length > 0) {
      setSections((prev) =>
        prev.map((s) => ({
          ...s,
          rows: [...selectedTasks.map((t) => newRowFromTask(t)), ...s.rows],
        }))
      );
    }
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
      </div>
    );
  }

  return (
    <div className="inspection-overlay">
      <div className="inspection-topbar">
        <img src={LOGO_URI} alt="Clean Connect" className="inspection-logo" />
        <h2>Besichtigungsmodus</h2>
        <label className="inspection-section-select">
          Bereich
          <select value={activeSectionId} onChange={(e) => setActiveSectionId(e.target.value)}>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <span className="inspection-count-badge">{selectedCount} ausgewählt</span>
        <button className="inspection-close" onClick={handleFinish}>
          Fertig ✓
        </button>
      </div>

      <div className="inspection-body">
        <div className="inspection-left">
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
                  Wird zu allen Bereichen hinzugefügt{activeSection ? ` (aktiv: ${activeSection.title})` : ''}
                </div>
              )}
              <textarea
                className="inspection-note-textarea"
                value={focusedTask.note}
                onChange={(e) => patchTask(focusedTask.id, { note: e.target.value })}
                placeholder="Anmerkungen zu dieser Leistung..."
              />
              <label className="inspection-note-toggle">
                <input
                  type="checkbox"
                  checked={focusedTask.noteForAll}
                  onChange={(e) => patchTask(focusedTask.id, { noteForAll: e.target.checked })}
                />
                Notiz für alle Bereiche
              </label>
            </>
          ) : (
            <p className="modal-hint">Wähle links eine Leistung aus, um Notizen zu hinterlegen.</p>
          )}

          <hr className="inspection-right-divider" />

          <div className="inspection-detail-heading">Objekt Notizen</div>
          <textarea
            className="inspection-note-textarea"
            value={objektNotizen}
            onChange={(e) => setObjektNotizen(e.target.value)}
            placeholder="Allgemeine Anmerkungen zur Besichtigung (intern, wird nicht im LV angezeigt)..."
          />
        </div>
      </div>
    </div>
  );
}

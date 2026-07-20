import React, { useState } from 'react';
import RowEditor from './RowEditor.jsx';
import { newEmptyRow } from '../templates/templates.js';

export default function SectionBlock({ section, index, totalSections, onChange, onRemove, onMove }) {
  const [dragOver, setDragOver] = useState(false);

  function setRows(rows) {
    onChange((s) => ({ ...s, rows }));
  }

  function updateRow(rowId, patch) {
    setRows(section.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  }

  function removeRow(rowId) {
    setRows(section.rows.filter((r) => r.id !== rowId));
  }

  function addRow() {
    setRows([...section.rows, newEmptyRow()]);
  }

  function moveRow(fromIndex, toIndex) {
    const rows = [...section.rows];
    const [moved] = rows.splice(fromIndex, 1);
    rows.splice(toIndex, 0, moved);
    setRows(rows);
  }

  function renameTitle(title) {
    onChange((s) => ({ ...s, title }));
  }

  return (
    <div
      className={`lv-section${dragOver ? ' drag-over' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/section-index', String(index));
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const from = Number(e.dataTransfer.getData('text/section-index'));
        if (!Number.isNaN(from) && from !== index) onMove(from, index);
      }}
    >
      <div className="lv-section-title-row">
        <span className="drag-handle no-print" title="Bereich verschieben">
          ⠿
        </span>
        <input
          className="lv-section-title"
          value={section.title}
          onChange={(e) => renameTitle(e.target.value)}
        />
        <button className="icon-btn no-print" title="Bereich entfernen" onClick={onRemove}>
          ✕
        </button>
      </div>
      <table className="lv-table">
        <tbody>
          {section.rows.map((row, rIndex) => (
            <RowEditor
              key={row.id}
              row={row}
              index={rIndex}
              onChange={(patch) => updateRow(row.id, patch)}
              onRemove={() => removeRow(row.id)}
              onMove={moveRow}
            />
          ))}
        </tbody>
      </table>
      <button className="add-row-btn no-print" onClick={addRow}>
        + Zeile hinzufügen
      </button>
    </div>
  );
}

import React, { useState } from 'react';
import RowEditor from './RowEditor.jsx';
import { newEmptyRow } from '../templates/templates.js';

export default function SectionBlock({ section, index, onChange, onRemove, onMove }) {
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

  function setPrice(price) {
    onChange((s) => ({ ...s, price }));
  }

  return (
    <>
      <tr
        className={`lv-section-header-row${dragOver ? ' drag-over' : ''}`}
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
        <td colSpan={7}>
          <span className="drag-handle no-print" title="Bereich verschieben">
            ⠿
          </span>
          <input
            className="lv-section-title"
            value={section.title}
            onChange={(e) => renameTitle(e.target.value)}
          />
          <button className="icon-btn no-print section-remove-btn" title="Bereich entfernen" onClick={onRemove}>
            ✕
          </button>
          <span className="section-price-field no-print">
            <span className="section-price-label">Preis (€)</span>
            <input
              type="number"
              className="section-price-input"
              value={section.price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
          </span>
        </td>
      </tr>
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
      <tr className="no-print">
        <td colSpan={7} className="add-row-cell">
          <button className="add-row-btn" onClick={addRow}>
            + Zeile hinzufügen
          </button>
        </td>
      </tr>
    </>
  );
}

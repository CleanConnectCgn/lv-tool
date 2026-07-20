import React, { useState } from 'react';

const INTERVAL_OPTIONS = ['', '1x', '2x', '3x', 'Tägl.', 'Wöchentl.', 'Monatl.'];

function IntervalSelect({ value, onChange }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)}>
      {INTERVAL_OPTIONS.map((opt) => (
        <option key={opt || 'leer'} value={opt}>
          {opt || 'leer'}
        </option>
      ))}
    </select>
  );
}

export default function RowEditor({ row, index, onChange, onRemove, onMove }) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <tr
      className={dragOver ? 'drag-over' : ''}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/row-index', String(index));
        e.stopPropagation();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        const from = Number(e.dataTransfer.getData('text/row-index'));
        if (!Number.isNaN(from) && from !== index) onMove(from, index);
      }}
    >
      <td className="col-desc">
        <span className="drag-handle no-print" title="Zeile verschieben">
          ⠿
        </span>
        <input
          type="text"
          value={row.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Leistungsbeschreibung"
        />
      </td>
      <td className="col-check">
        <input
          type="checkbox"
          checked={row.bedarf}
          onChange={(e) => onChange({ bedarf: e.target.checked })}
        />
      </td>
      <td className="col-interval">
        <IntervalSelect value={row.woechentlich} onChange={(v) => onChange({ woechentlich: v })} />
      </td>
      <td className="col-interval">
        <IntervalSelect value={row.monatlich} onChange={(v) => onChange({ monatlich: v })} />
      </td>
      <td className="col-interval">
        <IntervalSelect value={row.jaehrlich} onChange={(v) => onChange({ jaehrlich: v })} />
      </td>
      <td className="col-remarks">
        <input
          type="text"
          value={row.bemerkung}
          onChange={(e) => onChange({ bemerkung: e.target.value })}
          placeholder="Bemerkung"
        />
      </td>
      <td className="col-actions no-print">
        <button className="icon-btn" title="Zeile entfernen" onClick={onRemove}>
          ✕
        </button>
      </td>
    </tr>
  );
}

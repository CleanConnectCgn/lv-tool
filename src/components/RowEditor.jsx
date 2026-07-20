import React, { useRef, useState } from 'react';
import { INTERVAL_COLUMNS, INTERVAL_VALUES } from '../templates/templates.js';
import { getSuggestions } from '../templates/suggestions.js';

const COLUMN_LABELS = {
  woechentlich: 'Wöchentlich',
  monatlich: 'Monatlich',
  jaehrlich: 'Jährlich',
};

// Combined "column + value" choice, e.g. "woechentlich:2x", plus a "Bei Bedarf" option.
function buildIntervalOptions() {
  const opts = [{ value: '', label: '—' }];
  INTERVAL_COLUMNS.forEach((col) => {
    INTERVAL_VALUES.forEach((val) => {
      opts.push({ value: `${col}:${val}`, label: `${COLUMN_LABELS[col]} ${val}` });
    });
  });
  return opts;
}
const INTERVAL_OPTIONS = buildIntervalOptions();

export default function RowEditor({ row, index, onChange, onRemove, onMove }) {
  const [dragOver, setDragOver] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const blurTimeout = useRef(null);

  const intervalSelectValue = row.bedarf
    ? ''
    : row.intervalColumn && row.intervalValue
    ? `${row.intervalColumn}:${row.intervalValue}`
    : '';

  function handleBedarfToggle(checked) {
    if (checked) {
      onChange({ bedarf: true, intervalColumn: '', intervalValue: '' });
    } else {
      onChange({ bedarf: false });
    }
  }

  function handleIntervalChange(value) {
    if (!value) {
      onChange({ intervalColumn: '', intervalValue: '', bedarf: false });
      return;
    }
    const [col, val] = value.split(':');
    onChange({ intervalColumn: col, intervalValue: val, bedarf: false });
  }

  function handleTextChange(value) {
    onChange({ text: value });
    setSuggestions(getSuggestions(value));
  }

  function pickSuggestion(s) {
    onChange({ text: s });
    setShowSuggestions(false);
  }

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
        <div className="autocomplete-wrap">
          <input
            type="text"
            value={row.text}
            onChange={(e) => handleTextChange(e.target.value)}
            onFocus={() => {
              setSuggestions(getSuggestions(row.text));
              setShowSuggestions(true);
            }}
            onBlur={() => {
              blurTimeout.current = setTimeout(() => setShowSuggestions(false), 120);
            }}
            placeholder="Leistungsbeschreibung"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="autocomplete-list no-print">
              {suggestions.map((s) => (
                <li key={s} onMouseDown={() => pickSuggestion(s)}>
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
      </td>
      <td className="col-check">
        <input
          type="checkbox"
          checked={row.bedarf}
          onChange={(e) => handleBedarfToggle(e.target.checked)}
        />
      </td>
      <td className="col-interval" colSpan={3}>
        <select value={intervalSelectValue} onChange={(e) => handleIntervalChange(e.target.value)}>
          {INTERVAL_OPTIONS.map((o) => (
            <option key={o.value || 'none'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
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

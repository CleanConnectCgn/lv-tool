import React, { useEffect, useRef, useState } from 'react';
import { buildIntervalSelectOptions, intervalPatchFromSelectValue } from '../templates/templates.js';
import { getSuggestions, getRemarkSuggestions, getDescriptionFor } from '../templates/suggestions.js';
import WeekdaySelector from './WeekdaySelector.jsx';

const INTERVAL_OPTIONS = buildIntervalSelectOptions();

export default function RowEditor({ row, index, onChange, onRemove, onMove, selected = false, onToggleSelect }) {
  const [dragOver, setDragOver] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [remarkSuggestions, setRemarkSuggestions] = useState([]);
  const [showRemarkSuggestions, setShowRemarkSuggestions] = useState(false);
  const blurTimeout = useRef(null);
  const remarkBlurTimeout = useRef(null);
  const textareaRef = useRef(null);
  const beschreibungRef = useRef(null);

  function autoResize(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => {
    autoResize(textareaRef.current);
  }, [row.text]);

  useEffect(() => {
    autoResize(beschreibungRef.current);
  }, [row.beschreibung]);

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
    onChange(intervalPatchFromSelectValue(value));
  }

  function handleTextChange(value) {
    onChange({ text: value });
    setSuggestions(getSuggestions(value));
  }

  // Beim Übernehmen eines Vorschlags wird die ausformulierte
  // Leistungsbeschreibung aus dem Katalog gleich mitgesetzt - aber nur, wenn
  // das Feld noch leer ist, damit eine bereits angepasste Beschreibung nicht
  // überschrieben wird.
  function pickSuggestion(s) {
    const patch = { text: s };
    const katalogText = getDescriptionFor(s);
    if (katalogText && !(row.beschreibung || '').trim()) patch.beschreibung = katalogText;
    onChange(patch);
    setShowSuggestions(false);
  }

  function pickRemarkSuggestion(s) {
    onChange({ bemerkung: s });
    setShowRemarkSuggestions(false);
  }

  return (
    <tr
      className={`${dragOver ? 'drag-over' : ''}${selected ? ' row-selected' : ''}`}
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
      <td className="col-select no-print">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label="Zeile markieren"
        />
      </td>
      <td className="col-desc">
        <span className="drag-handle no-print" title="Zeile verschieben">
          ⠿
        </span>
        <div className="autocomplete-wrap">
          <textarea
            ref={textareaRef}
            rows={1}
            className="lv-desc-textarea"
            value={row.text}
            onChange={(e) => handleTextChange(e.target.value)}
            onFocus={() => {
              setSuggestions(getSuggestions(row.text));
              setShowSuggestions(true);
            }}
            onBlur={() => {
              blurTimeout.current = setTimeout(() => setShowSuggestions(false), 120);
            }}
            placeholder="Leistungsbezeichnung"
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
        {row.intervalColumn === 'woechentlich' && (
          <WeekdaySelector
            compact
            value={row.wochentage || []}
            onChange={(wochentage) =>
              // Kundenfeedback: Wochentage anklicken passte das Wöchentlich-
              // Intervall vorher nicht an (z.B. 2 angeklickte Tage, aber
              // Intervall blieb auf "1x" stehen) - jetzt synchron, solange
              // mindestens ein Tag ausgewählt ist.
              onChange({
                wochentage,
                intervalValue: wochentage.length > 0 ? `${wochentage.length}x` : row.intervalValue,
              })
            }
          />
        )}
      </td>
      <td className="col-remarks">
        <textarea
          ref={beschreibungRef}
          rows={1}
          className="lv-beschreibung-textarea"
          value={row.beschreibung || ''}
          onChange={(e) => onChange({ beschreibung: e.target.value })}
          placeholder="Leistungsbeschreibung"
        />
        <div className="autocomplete-wrap">
          <input
            type="text"
            className="lv-bemerkung-input"
            value={row.bemerkung}
            onChange={(e) => {
              onChange({ bemerkung: e.target.value });
              setRemarkSuggestions(getRemarkSuggestions(e.target.value));
            }}
            onFocus={() => {
              setRemarkSuggestions(getRemarkSuggestions(row.bemerkung));
              setShowRemarkSuggestions(true);
            }}
            onBlur={() => {
              remarkBlurTimeout.current = setTimeout(() => setShowRemarkSuggestions(false), 120);
            }}
            placeholder="Bemerkung (objektspezifisch)"
          />
          {showRemarkSuggestions && remarkSuggestions.length > 0 && (
            <ul className="autocomplete-list no-print">
              {remarkSuggestions.map((s) => (
                <li key={s} onMouseDown={() => pickRemarkSuggestion(s)}>
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
      </td>
      <td className="col-actions no-print">
        <button className="icon-btn" title="Zeile entfernen" aria-label="Zeile entfernen" onClick={onRemove}>
          ✕
        </button>
      </td>
    </tr>
  );
}

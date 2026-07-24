import React from 'react';

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// Zusatzfeld zur bestehenden Intervall-Spalten-Logik (woechentlich/monatlich/
// jaehrlich × 1x-7x). Erzeugt aus den ausgewählten Tagen einen lesbaren Text
// wie "3x wöchentlich (Mo, Mi, Fr)", ohne das bestehende Datenmodell zu ändern.
export function weekdaysLabel(selected) {
  if (!selected || selected.length === 0) return '';
  const sorted = DAYS.filter((d) => selected.includes(d));
  return `${sorted.length}x wöchentlich (${sorted.join(', ')})`;
}

export default function WeekdaySelector({ value = [], onChange, compact = false }) {
  function toggle(day) {
    const next = value.includes(day) ? value.filter((d) => d !== day) : [...value, day];
    onChange(next);
  }

  return (
    <div className={`weekday-selector${compact ? ' compact' : ''}`}>
      <div className="weekday-selector-days">
        {DAYS.map((day) => (
          <button
            key={day}
            type="button"
            className={`weekday-btn${value.includes(day) ? ' active' : ''}`}
            onClick={() => toggle(day)}
          >
            {day}
          </button>
        ))}
      </div>
      <span className="weekday-preview">{weekdaysLabel(value) || 'Noch keine Tage gewählt'}</span>
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import SectionBlock from './SectionBlock.jsx';
import { buildIntervalSelectOptions } from '../templates/templates.js';
import { applyBulkInterval, deleteSelected } from '../lib/bulkEdit.js';

const BULK_INTERVAL_OPTIONS = buildIntervalSelectOptions({ includeBedarf: true });

export default function LVEditor({ sections, setSections }) {
  function updateSection(id, updater) {
    setSections((prev) => prev.map((s) => (s.id === id ? updater(s) : s)));
  }

  function removeSection(id) {
    setSections((prev) => prev.filter((s) => s.id !== id));
  }

  function moveSection(fromIndex, toIndex) {
    setSections((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  // Markierte Zeilen (über Bereiche hinweg) und markierte Bereiche - getrennt
  // gehalten, weil sie unterschiedliche Bulk-Aktionen auslösen: Zeilen tragen
  // ein Intervall und lassen sich einzeln löschen, Bereiche nur als Ganzes.
  const [selectedRowIds, setSelectedRowIds] = useState(() => new Set());
  const [selectedSectionIds, setSelectedSectionIds] = useState(() => new Set());
  const [bulkIntervalValue, setBulkIntervalValue] = useState('');

  const allRowIds = useMemo(
    () => sections.flatMap((s) => (s.rows || []).map((r) => r.id)),
    [sections]
  );

  function toggleRow(rowId) {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }

  function toggleSection(sectionId) {
    setSelectedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  // Wählt alle Zeilen im Dokument auf einmal aus bzw. hebt die Auswahl auf -
  // fürs schnelle "alles auf ein Intervall setzen".
  function toggleAllRows() {
    setSelectedRowIds((prev) => (prev.size === allRowIds.length ? new Set() : new Set(allRowIds)));
  }

  function clearSelection() {
    setSelectedRowIds(new Set());
    setSelectedSectionIds(new Set());
    setBulkIntervalValue('');
  }

  function handleApplyBulkInterval() {
    setSections((prev) => applyBulkInterval(prev, selectedRowIds, bulkIntervalValue));
  }

  function handleDeleteSelected() {
    setSections((prev) => deleteSelected(prev, selectedRowIds, selectedSectionIds));
    clearSelection();
  }

  const anzahlMarkiert = selectedRowIds.size + selectedSectionIds.size;

  return (
    <div className="lv-table-scroll">
      {anzahlMarkiert > 0 && (
        <div className="lv-bulk-toolbar no-print">
          <span className="lv-bulk-count">
            {selectedRowIds.size > 0 && `${selectedRowIds.size} Zeile${selectedRowIds.size === 1 ? '' : 'n'}`}
            {selectedRowIds.size > 0 && selectedSectionIds.size > 0 && ', '}
            {selectedSectionIds.size > 0 &&
              `${selectedSectionIds.size} Bereich${selectedSectionIds.size === 1 ? '' : 'e'}`}
            {' markiert'}
          </span>

          {selectedRowIds.size > 0 && (
            <span className="lv-bulk-group">
              <select value={bulkIntervalValue} onChange={(e) => setBulkIntervalValue(e.target.value)}>
                <option value="" disabled>
                  Intervall wählen…
                </option>
                {BULK_INTERVAL_OPTIONS.map((o) => (
                  <option key={o.value || 'none'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button type="button" onClick={handleApplyBulkInterval} disabled={!bulkIntervalValue}>
                Anwenden
              </button>
            </span>
          )}

          <button type="button" className="ai-btn-remove" onClick={handleDeleteSelected}>
            Markiertes löschen
          </button>
          <button type="button" onClick={clearSelection}>
            Auswahl aufheben
          </button>
        </div>
      )}

      <table className="lv-table">
        <thead>
          <tr>
            <th className="col-select no-print">
              <input
                type="checkbox"
                checked={allRowIds.length > 0 && selectedRowIds.size === allRowIds.length}
                onChange={toggleAllRows}
                aria-label="Alle Zeilen markieren"
                title="Alle Zeilen markieren"
              />
            </th>
            <th className="col-desc">Einzelleistungen Reinigung</th>
            <th className="col-check">Bei Bedarf</th>
            <th className="col-interval" colSpan={3}>
              Intervall
            </th>
            <th className="col-remarks">Leistungsbeschreibung &amp; Bemerkung</th>
            <th className="col-actions no-print"></th>
          </tr>
        </thead>
        <tbody>
          {sections.map((section, index) => (
            <SectionBlock
              key={section.id}
              section={section}
              index={index}
              onChange={(updater) => updateSection(section.id, updater)}
              onRemove={() => removeSection(section.id)}
              onMove={moveSection}
              sectionSelected={selectedSectionIds.has(section.id)}
              onToggleSection={() => toggleSection(section.id)}
              selectedRowIds={selectedRowIds}
              onToggleRow={toggleRow}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

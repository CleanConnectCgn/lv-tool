// Reine Funktionen für das Bulk-Edit im LV-Editor (mehrere markierte Zeilen
// oder Bereiche auf einmal ändern/löschen). Getrennt von LVEditor.jsx, damit
// sich die eigentliche Logik ohne React testen lässt - analog zu
// lvActions.js für den Assistenten.

import { intervalPatchFromSelectValue } from '../templates/templates.js';

/**
 * Setzt das Intervall aller markierten Zeilen (über Bereiche hinweg) auf
 * denselben Wert. Nicht markierte Zeilen bleiben unverändert.
 *
 * @param {Array} sections
 * @param {Set<string>} selectedRowIds
 * @param {string} intervalValue  Wert im Format von buildIntervalSelectOptions(), z.B. "woechentlich:2x" oder "bedarf"
 */
export function applyBulkInterval(sections, selectedRowIds, intervalValue) {
  if (!intervalValue || !selectedRowIds || selectedRowIds.size === 0) return sections;
  const patch = intervalPatchFromSelectValue(intervalValue);
  return sections.map((s) => ({
    ...s,
    rows: (s.rows || []).map((r) => (selectedRowIds.has(r.id) ? { ...r, ...patch } : r)),
  }));
}

/**
 * Entfernt markierte Bereiche komplett (inklusive ihrer Zeilen, auch wenn
 * diese nicht einzeln markiert waren) und markierte Zeilen aus den
 * verbleibenden Bereichen - in einem Schritt.
 *
 * @param {Array} sections
 * @param {Set<string>} selectedRowIds
 * @param {Set<string>} selectedSectionIds
 */
export function deleteSelected(sections, selectedRowIds, selectedSectionIds) {
  const rowIds = selectedRowIds || new Set();
  const sectionIds = selectedSectionIds || new Set();
  if (rowIds.size === 0 && sectionIds.size === 0) return sections;
  return sections
    .filter((s) => !sectionIds.has(s.id))
    .map((s) => ({
      ...s,
      rows: (s.rows || []).filter((r) => !rowIds.has(r.id)),
    }));
}

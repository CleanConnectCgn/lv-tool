import React from 'react';
import SectionBlock from './SectionBlock.jsx';

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

  return (
    <table className="lv-table">
      <thead>
        <tr>
          <th className="col-desc">Einzelleistungen Reinigung</th>
          <th className="col-check">Bei Bedarf</th>
          <th className="col-interval" colSpan={3}>
            Intervall
          </th>
          <th className="col-remarks">Bemerkungen</th>
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
          />
        ))}
      </tbody>
    </table>
  );
}

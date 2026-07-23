import React from 'react';
import { LOGO_URI } from '../assets/logo.js';

function formatDatum(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

function CheckBox({ on }) {
  return <span className={`pv-check-box${on ? ' on' : ''}`}>{on ? '✓' : ''}</span>;
}

function ColumnHead() {
  return (
    <thead>
      <tr>
        <th className="pv-col-desc">Einzelleistungen Reinigung</th>
        <th className="pv-col-check">Bei Bedarf</th>
        <th className="pv-col-interval">Wöchentlich</th>
        <th className="pv-col-interval">Monatlich</th>
        <th className="pv-col-interval">Jährlich</th>
        <th className="pv-col-remarks">Bemerkungen</th>
      </tr>
    </thead>
  );
}

function IntervalCell({ column, value }) {
  return (
    <td className="pv-col-interval">
      {value ? <span className="pv-interval-chip">{value}</span> : ''}
    </td>
  );
}

function DataRow({ row }) {
  return (
    <tr>
      <td className="pv-col-desc">{row.text}</td>
      <td className="pv-col-check">
        <CheckBox on={row.bedarf} />
      </td>
      {row.intervalColumn === 'aufAnfrage' ? (
        <td className="pv-col-interval pv-col-interval-freeform" colSpan={3}>
          <span className="pv-interval-chip">Auf Anfrage</span>
        </td>
      ) : (
        <>
          <IntervalCell value={row.intervalColumn === 'woechentlich' ? row.intervalValue : ''} />
          <IntervalCell value={row.intervalColumn === 'monatlich' ? row.intervalValue : ''} />
          <IntervalCell value={row.intervalColumn === 'jaehrlich' ? row.intervalValue : ''} />
        </>
      )}
      <td className="pv-col-remarks">{row.bemerkung}</td>
    </tr>
  );
}

function DocPage({ lvTitle, objekt, datum, sections, pageBreakBefore }) {
  return (
    <div className={`pv-page${pageBreakBefore ? ' pv-page-break' : ''}`}>
      <div className="pv-doc-header">
        <div className="pv-title-row">
          <div className="pv-title-cell">
            <div className="pv-kicker">Clean Connect Gebäudereinigung</div>
            <h1>{lvTitle}</h1>
          </div>
          <div className="pv-logo-cell">
            <img src={LOGO_URI} alt="Clean Connect" className="pv-logo-img" />
          </div>
        </div>
        <div className="pv-meta-row">
          <div className="pv-meta-cell">
            <span className="pv-meta-label">Objekt</span>
            {objekt}
          </div>
          <div className="pv-meta-cell pv-meta-center pv-meta-static">
            <span className="pv-meta-label">Reinigung Intervalle</span>
          </div>
          <div className="pv-meta-cell pv-meta-right">
            <span className="pv-meta-label">Stand</span>
            {formatDatum(datum)}
          </div>
        </div>
      </div>

      {/* Jeder Bereich ist ein eigener, unteilbarer Block mit wiederholtem
          Spaltenkopf. So bleibt die Bereichsüberschrift nie allein am
          Seitenende und jede Seite beginnt mit der vollständigen
          Tabellenüberschrift. */}
      {sections.map((section) => (
        <div className="pv-section-block" key={section.id}>
          <table className="pv-table">
            <ColumnHead />
            <tbody>
              <tr className="pv-section-row">
                <td colSpan={6}>{section.title}</td>
              </tr>
              {section.rows
                .filter((r) => r.text.trim())
                .map((row) => (
                  <DataRow key={row.id} row={row} />
                ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// docs: [{ lvTitle, sections }] - jedes verknüpfte Dokument (Hauptdokument +
// z. B. Glasreinigung/Winterdienst) bekommt seine eigene Seite mit eigenem
// Überschriften-Layout, damit der PDF-Export alle Leistungsverzeichnisse in
// einer Datei zusammenfasst statt nur die aktive Editor-Ansicht.
export default function PrintView({ lvTitle, objekt, datum, sections, docs }) {
  const pages = docs && docs.length > 0 ? docs : [{ lvTitle, sections }];
  return (
    <div className="print-view" id="lv-print-view">
      {pages.map((doc, i) => (
        <DocPage
          key={i}
          lvTitle={doc.lvTitle}
          objekt={objekt}
          datum={datum}
          sections={doc.sections}
          pageBreakBefore={i > 0}
        />
      ))}
    </div>
  );
}

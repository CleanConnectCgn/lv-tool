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

function DocPage({ lvTitle, objekt, datum, intervallInfo, sections, pageBreakBefore }) {
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
          <div className="pv-meta-cell pv-meta-center">
            <span className="pv-meta-label">Reinigung Intervalle</span>
            {intervallInfo}
          </div>
          <div className="pv-meta-cell pv-meta-right">
            <span className="pv-meta-label">Stand</span>
            {formatDatum(datum)}
          </div>
        </div>
      </div>

      <table className="pv-table">
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
        <tbody>
          {sections.map((section) => (
            <React.Fragment key={section.id}>
              <tr className="pv-section-row">
                <td colSpan={6}>{section.title}</td>
              </tr>
              {section.rows
                .filter((r) => r.text.trim())
                .map((row) => (
                  <tr key={row.id}>
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
                        <td className="pv-col-interval">
                          {row.intervalColumn === 'woechentlich' && row.intervalValue ? (
                            <span className="pv-interval-chip">{row.intervalValue}</span>
                          ) : (
                            ''
                          )}
                        </td>
                        <td className="pv-col-interval">
                          {row.intervalColumn === 'monatlich' && row.intervalValue ? (
                            <span className="pv-interval-chip">{row.intervalValue}</span>
                          ) : (
                            ''
                          )}
                        </td>
                        <td className="pv-col-interval">
                          {row.intervalColumn === 'jaehrlich' && row.intervalValue ? (
                            <span className="pv-interval-chip">{row.intervalValue}</span>
                          ) : (
                            ''
                          )}
                        </td>
                      </>
                    )}
                    <td className="pv-col-remarks">{row.bemerkung}</td>
                  </tr>
                ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <div className="pv-footer">
        <span className="pv-footer-brand">cleanconnect.de</span>
        <span>{lvTitle}</span>
        <span>Clean Connect Gebäudereinigung UG</span>
      </div>
    </div>
  );
}

// docs: [{ lvTitle, sections }] - jedes verknüpfte Dokument (Hauptdokument +
// z. B. Glasreinigung/Winterdienst) bekommt seine eigene Seite mit eigenem
// Überschriften-Layout, damit der PDF-Export alle Leistungsverzeichnisse in
// einer Datei zusammenfasst statt nur die aktive Editor-Ansicht.
export default function PrintView({ lvTitle, objekt, datum, intervallInfo, sections, docs }) {
  const pages = docs && docs.length > 0 ? docs : [{ lvTitle, sections }];
  return (
    <div className="print-view" id="lv-print-view">
      {pages.map((doc, i) => (
        <DocPage
          key={i}
          lvTitle={doc.lvTitle}
          objekt={objekt}
          datum={datum}
          intervallInfo={intervallInfo}
          sections={doc.sections}
          pageBreakBefore={i > 0}
        />
      ))}
    </div>
  );
}

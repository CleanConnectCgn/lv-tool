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

export default function PrintView({ lvTitle, objekt, datum, intervallInfo, sections }) {
  return (
    <div className="print-view" id="lv-print-view">
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
                    <td className="pv-col-remarks">{row.bemerkung}</td>
                  </tr>
                ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <div className="pv-footer">
        <span className="pv-footer-brand">cleanconnect.de</span>
        <span>Seite 1</span>
        <span>Clean Connect Gebäudereinigung UG</span>
      </div>
    </div>
  );
}

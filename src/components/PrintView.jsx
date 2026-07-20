import React, { useState } from 'react';
import { CLEAN_CONNECT_LOGO_BASE64 } from '../assets/logo.js';

function formatDatum(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

function Check({ on }) {
  return <span className={`pv-check${on ? ' on' : ''}`}>{on ? '✓' : ''}</span>;
}

export default function PrintView({ objekt, datum, intervallInfo, sections }) {
  const [logoFailed, setLogoFailed] = useState(false);
  return (
    <div className="print-view" id="lv-print-view">
      <div className="pv-header">
        <div className="pv-titles">
          <h1>Leistungsverzeichnis Unterhaltsreinigung</h1>
        </div>
        <div className="pv-logo">
          {CLEAN_CONNECT_LOGO_BASE64 && !logoFailed ? (
            <img
              src={CLEAN_CONNECT_LOGO_BASE64}
              alt="Clean Connect"
              className="pv-logo-img"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            'CLEAN CONNECT'
          )}
        </div>
      </div>
      <div className="pv-meta-bar">
        <div className="pv-meta-field">
          <span className="pv-meta-label">Objekt</span>
          <span className="pv-meta-value">{objekt || '—'}</span>
        </div>
        <div className="pv-meta-field">
          <span className="pv-meta-label">Reinigung Intervalle</span>
          <span className="pv-meta-value">{intervallInfo || '—'}</span>
        </div>
        <div className="pv-meta-field">
          <span className="pv-meta-label">Stand</span>
          <span className="pv-meta-value">{formatDatum(datum)}</span>
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
                      <Check on={row.bedarf} />
                    </td>
                    <td className="pv-col-interval">
                      {row.intervalColumn === 'woechentlich' ? row.intervalValue : ''}
                    </td>
                    <td className="pv-col-interval">
                      {row.intervalColumn === 'monatlich' ? row.intervalValue : ''}
                    </td>
                    <td className="pv-col-interval">
                      {row.intervalColumn === 'jaehrlich' ? row.intervalValue : ''}
                    </td>
                    <td className="pv-col-remarks">{row.bemerkung}</td>
                  </tr>
                ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <div className="pv-footer">
        <span className="pv-page-number" />
      </div>
    </div>
  );
}

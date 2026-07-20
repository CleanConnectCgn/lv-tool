import React from 'react';
import { CLEAN_CONNECT_LOGO_BASE64 } from '../assets/logo.js';

export default function Header({
  lvTitle,
  setLvTitle,
  objekt,
  setObjekt,
  datum,
  setDatum,
  intervallInfo,
  setIntervallInfo,
}) {
  return (
    <div className="doc-header">
      <div className="doc-title-row">
        <div className="doc-title-cell">
          <input
            className="doc-title-input"
            value={lvTitle}
            onChange={(e) => setLvTitle(e.target.value)}
          />
        </div>
        <div className="doc-logo-cell">
          <img src={CLEAN_CONNECT_LOGO_BASE64} alt="Clean Connect" className="doc-logo-img" />
        </div>
      </div>
      <div className="doc-meta-row">
        <div className="doc-meta-cell doc-meta-left">
          <span>Objekt:</span>
          <input
            type="text"
            value={objekt}
            onChange={(e) => setObjekt(e.target.value)}
            placeholder="Objektname / Adresse"
          />
        </div>
        <div className="doc-meta-cell doc-meta-center">
          <span>Reinigung Intervalle:</span>
          <input
            type="text"
            value={intervallInfo}
            onChange={(e) => setIntervallInfo(e.target.value)}
            placeholder="z.B. lt. Leistungsverzeichnis"
          />
        </div>
        <div className="doc-meta-cell doc-meta-right">
          <span>Stand:</span>
          <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
        </div>
      </div>
    </div>
  );
}

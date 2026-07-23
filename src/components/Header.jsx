import React from 'react';
import { LOGO_URI } from '../assets/logo.js';

export default function Header({
  lvTitle,
  setLvTitle,
  objekt,
  setObjekt,
  datum,
  setDatum,
}) {
  return (
    <div className="doc-header">
      <div className="doc-title-row">
        <div className="doc-title-cell">
          <div className="doc-kicker">Clean Connect Gebäudereinigung</div>
          <input
            className="doc-title-input"
            value={lvTitle}
            onChange={(e) => setLvTitle(e.target.value)}
          />
        </div>
        <div className="doc-logo-cell">
          <img src={LOGO_URI} alt="Clean Connect" className="doc-logo-img" />
        </div>
      </div>
      <div className="doc-meta-row">
        <div className="doc-meta-cell doc-meta-left">
          <span>Objekt</span>
          <input
            type="text"
            value={objekt}
            onChange={(e) => setObjekt(e.target.value)}
            placeholder="Objektname / Adresse"
          />
        </div>
        <div className="doc-meta-cell doc-meta-center doc-meta-static">
          <span>Reinigung Intervalle</span>
        </div>
        <div className="doc-meta-cell doc-meta-right">
          <span>Stand</span>
          <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
        </div>
      </div>
    </div>
  );
}

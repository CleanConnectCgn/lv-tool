import React from 'react';

export default function Header({ objekt, setObjekt, datum, setDatum, intervallInfo, setIntervallInfo }) {
  return (
    <div className="lv-header">
      <div className="lv-header-top">
        <div className="lv-header-titles">
          <h1>Leistungsverzeichnis</h1>
          <div className="lv-subtitle">Clean Connect Gebäudereinigung</div>
        </div>
        <div className="lv-logo">
          <div className="lv-logo-box">Clean Connect</div>
        </div>
      </div>
      <div className="lv-header-bar">
        <div className="lv-header-field">
          <span className="lv-header-label">Objekt</span>
          <input
            type="text"
            value={objekt}
            onChange={(e) => setObjekt(e.target.value)}
            placeholder="Objektname / Adresse"
          />
        </div>
        <div className="lv-header-field">
          <span className="lv-header-label">Datum</span>
          <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
        </div>
        <div className="lv-header-field">
          <span className="lv-header-label">Intervall</span>
          <input
            type="text"
            value={intervallInfo}
            onChange={(e) => setIntervallInfo(e.target.value)}
            placeholder="z.B. lt. Leistungsverzeichnis"
          />
        </div>
      </div>
    </div>
  );
}

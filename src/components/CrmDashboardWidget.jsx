import React, { useEffect, useState } from 'react';
import { listAuftraege, getCalendarStatus, listCalendarEvents } from '../lib/crm.js';

const OFFEN_TAGE_SCHWELLE = 14;

function formatDateTimeDE(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function CrmDashboardWidget({ onOpenCrm }) {
  const [langeOffen, setLangeOffen] = useState([]);
  const [termine, setTermine] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const grenzwert = Date.now() - OFFEN_TAGE_SCHWELLE * 24 * 60 * 60 * 1000;
    listAuftraege()
      .then((all) => {
        setLangeOffen(all.filter((a) => a.status === 'offen' && new Date(a.createdAt).getTime() < grenzwert));
      })
      .catch(() => setLangeOffen([]))
      .finally(() => setLoaded(true));

    getCalendarStatus()
      .then((s) => {
        if (!s.connected) return [];
        const timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        return listCalendarEvents({ timeMax });
      })
      .then((events) => setTermine(events || []))
      .catch(() => setTermine([]));
  }, []);

  if (!loaded || (langeOffen.length === 0 && termine.length === 0)) return null;

  return (
    <div className="overview-page-card crm-dashboard-widget">
      <h2>Braucht Aufmerksamkeit</h2>
      {langeOffen.length > 0 && (
        <div>
          <div className="modal-subheading">
            {langeOffen.length} Auftrag{langeOffen.length === 1 ? '' : 'äge'} seit über {OFFEN_TAGE_SCHWELLE} Tagen offen
          </div>
          {langeOffen.slice(0, 5).map((a) => (
            <div key={a.id} className="overview-row" onClick={onOpenCrm}>
              <div className="overview-row-main">
                <div className="overview-row-title">{a.titel}</div>
                <div className="overview-row-sub">{a.customerName}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {termine.length > 0 && (
        <div>
          <div className="modal-subheading">Termine in den nächsten 7 Tagen ({termine.length})</div>
          {termine.slice(0, 5).map((e) => (
            <div key={e.id} className="overview-row">
              <div className="overview-row-main">
                <div className="overview-row-title">{e.summary}</div>
                <div className="overview-row-sub">{formatDateTimeDE(e.start?.dateTime || e.start?.date)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

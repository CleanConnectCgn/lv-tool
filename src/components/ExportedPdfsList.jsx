import React, { useEffect, useState } from 'react';
import { listLvPdfs, lvPdfDownloadUrl } from '../lib/lvPdfs.js';

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function ExportedPdfsList() {
  const [pdfs, setPdfs] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    listLvPdfs()
      .then((list) => {
        setPdfs(list);
        setStatus('done');
      })
      .catch((err) => {
        setError(err?.message || 'Unbekannter Fehler');
        setStatus('error');
      });
  }, []);

  if (status === 'loading') return null;
  if (status === 'error') {
    return (
      <div className="exported-pdfs">
        <div className="modal-subheading">Exportierte Leistungsverzeichnisse</div>
        <div className="modal-message error">Liste konnte nicht geladen werden: {error}</div>
      </div>
    );
  }
  if (pdfs.length === 0) return null;

  return (
    <div className="exported-pdfs">
      <div className="modal-subheading">Exportierte Leistungsverzeichnisse</div>
      <div className="exported-pdfs-list">
        {pdfs.map((p) => (
          <a
            key={p.filename}
            className="exported-pdf-row"
            href={lvPdfDownloadUrl(p.filename)}
            download={p.filename}
          >
            <span className="exported-pdf-name">{p.filename}</span>
            <span className="exported-pdf-date">{formatDate(p.mtime)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

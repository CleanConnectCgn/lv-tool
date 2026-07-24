import React, { useState } from 'react';
import { analyzeLvFile, analysisToSections } from '../lib/lvFromImage.js';

export default function LvFromFileModal({ onApply, onClose }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [status, setStatus] = useState('idle'); // idle | running | done | error
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState(null);

  function handleFile(f) {
    if (!f) return;
    setFile(f);
    setAnalysis(null);
    setStatus('idle');
    setError('');
    if (f.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(f));
    } else {
      setPreviewUrl('');
    }
  }

  async function handleAnalyze() {
    if (!file) return;
    setStatus('running');
    setError('');
    try {
      const data = await analyzeLvFile(file);
      setAnalysis(data);
      setStatus('done');
    } catch (err) {
      setError(err?.message || err?.toString() || 'Unbekannter Fehler');
      setStatus('error');
    }
  }

  function handleApply() {
    if (!analysis) return;
    onApply(analysisToSections(analysis), analysis);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>LV aus Datei erstellen</h2>
        <p className="modal-hint">Foto oder Scan eines bestehenden LVs / einer Reinigungsanforderung hochladen.</p>

        <label className="modal-field">
          Datei (JPG, PNG, PDF)
          <input
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>

        {previewUrl && (
          <img src={previewUrl} alt="Vorschau" style={{ maxWidth: '100%', maxHeight: 240, marginTop: 10 }} />
        )}
        {file && !previewUrl && <p className="modal-hint">{file.name}</p>}

        {file && status !== 'running' && (
          <button className="primary" onClick={handleAnalyze} style={{ marginTop: 10 }}>
            Analysieren
          </button>
        )}

        {status === 'running' && (
          <div className="ai-loading">
            <div className="ai-spinner" />
            <p>Gemini analysiert die Datei...</p>
          </div>
        )}

        {status === 'error' && <div className="modal-message error">{error}</div>}

        {status === 'done' && analysis && (
          <div className="ai-dual-result" style={{ marginTop: 12 }}>
            <p>
              Erkannte Branche: <strong>{analysis.erkannte_branche || 'unbekannt'}</strong> · Konfidenz:{' '}
              <strong>{Math.round((analysis.konfidenz || 0) * 100)}%</strong>
            </p>
            {analysis.konfidenz != null && analysis.konfidenz < 0.7 && (
              <div className="modal-message error">
                Konfidenz niedrig — bitte Ergebnisse vor dem Speichern sorgfältig prüfen.
              </div>
            )}
            <p>{(analysis.bereiche || []).length} Bereiche mit insgesamt{' '}
              {(analysis.bereiche || []).reduce((sum, b) => sum + (b.positionen || []).length, 0)} Positionen erkannt.
            </p>
            {analysis.hinweise?.length > 0 && (
              <div>
                <strong>Hinweise:</strong>
                <ul>
                  {analysis.hinweise.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button onClick={onClose}>Abbrechen</button>
          {status === 'done' && (
            <button className="primary" onClick={handleApply}>
              LV mit diesen Daten befüllen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

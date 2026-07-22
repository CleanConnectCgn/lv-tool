import React, { useState, useMemo, useEffect } from 'react';
import Header from './components/Header.jsx';
import LVEditor from './components/LVEditor.jsx';
import PrintView from './components/PrintView.jsx';
import SevDeskModal from './components/SevDeskModal.jsx';
import InspectionMode from './components/InspectionMode.jsx';
import AICheckupModal from './components/AICheckupModal.jsx';
import AIStatusBadge from './components/AIStatusBadge.jsx';
import { templates, cloneTemplate, cloneOptionalSection, newSection } from './templates/templates.js';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function App() {
  const [lvType, setLvType] = useState('buero');
  const [lvTitle, setLvTitle] = useState('Leistungsverzeichnis Unterhaltsreinigung');
  const [objekt, setObjekt] = useState('');
  const [datum, setDatum] = useState(todayISO());
  const [intervallInfo, setIntervallInfo] = useState('');
  const [sections, setSections] = useState(() => cloneTemplate('buero'));
  const [showSevDesk, setShowSevDesk] = useState(false);
  const [showInspection, setShowInspection] = useState(false);
  const [showAICheckup, setShowAICheckup] = useState(false);
  const [aiStatus, setAiStatus] = useState('idle');
  const [aiIssues, setAiIssues] = useState([]);
  const [aiError, setAiError] = useState('');

  const templateOptions = useMemo(
    () => Object.entries(templates).map(([key, t]) => ({ key, label: t.label })),
    []
  );

  function handleTemplateChange(key) {
    setLvType(key);
    setSections(cloneTemplate(key));
  }

  function addOptionalService(key) {
    const s = cloneOptionalSection(key);
    if (s) setSections((prev) => [...prev, s]);
  }

  function addSection() {
    setSections((prev) => [...prev, newSection()]);
  }

  async function runAICheck() {
    setAiStatus('pending');
    setAiError('');
    try {
      const res = await fetch('/api/ai-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        throw new Error(data?.error?.message || data?.error || 'Unbekannter Fehler');
      }
      setAiIssues(Array.isArray(data?.issues) ? data.issues : []);
      setAiStatus('done');
    } catch (err) {
      setAiError(err?.message || err?.toString() || 'Unbekannter Fehler');
      setAiStatus('error');
    }
  }

  // Auto-run the AI checkup 3s after the last edit to the LV.
  useEffect(() => {
    const timer = setTimeout(() => {
      runAICheck();
    }, 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  useEffect(() => {
    async function exportPdf() {
      const { default: html2pdf } = await import('html2pdf.js');
      const el = document.getElementById('lv-print-view');
      const safeObjekt = (objekt || 'Objekt').replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g, '_');
      const filename = `Leistungsverzeichnis_${safeObjekt}_${datum}.pdf`;
      // The print-view is normally hidden (opacity:0, position:absolute) and only
      // becomes visible/static via an @media print rule. html2canvas clones the
      // DOM without reliably applying that media query, which collapses the
      // element to zero height. Apply the same overrides directly instead.
      document.body.classList.add('exporting-pdf');
      try {
        await html2pdf()
          .set({
            margin: 10,
            filename,
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'] },
          })
          .from(el)
          .save();
      } finally {
        document.body.classList.remove('exporting-pdf');
      }
    }
    window.addEventListener('lv-export-pdf', exportPdf);
    return () => window.removeEventListener('lv-export-pdf', exportPdf);
  }, [objekt, datum]);

  return (
    <div className="app-shell">
      <div className="toolbar no-print">
        <div className="toolbar-group">
          <label>
            LV-Typ:
            <select value={lvType} onChange={(e) => handleTemplateChange(e.target.value)}>
              {templateOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Zusatzleistung hinzufügen:
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) addOptionalService(e.target.value);
                e.target.value = '';
              }}
            >
              <option value="">Bitte wählen</option>
              <option value="glasreinigung">Glasreinigung</option>
              <option value="lamellenreinigung">Lamellenreinigung</option>
              <option value="grundreinigung">Grundreinigung</option>
            </select>
          </label>
          <button onClick={addSection}>+ Bereich hinzufügen</button>
        </div>
        <div className="toolbar-group">
          <button onClick={() => window.print()}>Drucken</button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('lv-export-pdf'))}>
            Als PDF exportieren
          </button>
          <button
            onClick={() => {
              setShowAICheckup(true);
              runAICheck();
            }}
          >
            ✨ KI Checkup
          </button>
          <AIStatusBadge status={aiStatus} issues={aiIssues} onClick={() => setShowAICheckup(true)} />
          <button onClick={() => setShowSevDesk(true)}>An sevDesk senden</button>
          <button onClick={() => setShowInspection(true)}>Besichtigungsmodus</button>
        </div>
      </div>

      <div className="lv-document" id="lv-document">
        <Header
          lvTitle={lvTitle}
          setLvTitle={setLvTitle}
          objekt={objekt}
          setObjekt={setObjekt}
          datum={datum}
          setDatum={setDatum}
          intervallInfo={intervallInfo}
          setIntervallInfo={setIntervallInfo}
        />
        <LVEditor sections={sections} setSections={setSections} />
        <div className="doc-footer">
          <span className="doc-footer-brand">cleanconnect.de</span>
          <span>Seite 1</span>
          <span>Clean Connect Gebäudereinigung UG</span>
        </div>
      </div>

      <PrintView
        lvTitle={lvTitle}
        objekt={objekt}
        datum={datum}
        intervallInfo={intervallInfo}
        sections={sections}
      />

      {showSevDesk && (
        <SevDeskModal
          onClose={() => setShowSevDesk(false)}
          objekt={objekt}
          datum={datum}
          intervallInfo={intervallInfo}
          sections={sections}
          lvTypeLabel={templates[lvType]?.label || ''}
        />
      )}

      {showInspection && (
        <InspectionMode
          sections={sections}
          setSections={setSections}
          onClose={() => setShowInspection(false)}
        />
      )}

      {showAICheckup && (
        <AICheckupModal
          status={aiStatus}
          issues={aiIssues}
          error={aiError}
          setSections={setSections}
          onClose={() => setShowAICheckup(false)}
          onRecheck={runAICheck}
        />
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import Header from './components/Header.jsx';
import LVEditor from './components/LVEditor.jsx';
import PrintView from './components/PrintView.jsx';
import SevDeskModal from './components/SevDeskModal.jsx';
import CustomerModal from './components/CustomerModal.jsx';
import InspectionMode from './components/InspectionMode.jsx';
import AICheckupModal from './components/AICheckupModal.jsx';
import AIStatusBadge from './components/AIStatusBadge.jsx';
import Overview from './components/Overview.jsx';
import QuickSetup from './components/QuickSetup.jsx';
import { cloneOptionalSection, newSection } from './templates/templates.js';
import { createDocument, updateDocument, getDocument, listDocuments } from './lib/documents.js';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addressLine(customer) {
  if (!customer) return '';
  return [customer.street, [customer.zip, customer.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
}

function blankMainDoc() {
  return { id: null, lvTitle: 'Leistungsverzeichnis Unterhaltsreinigung', sections: [] };
}

export default function App() {
  // 'overview' (Startseite) | 'setup' (Quick-Setup-Assistent) | 'editor'
  const [view, setView] = useState('overview');

  // Ein Kunde/Objekt kann mehrere verknüpfte Leistungsverzeichnisse haben
  // (z. B. Unterhaltsreinigung + eigenständige Glasreinigung/Winterdienst-LVs).
  // mainDoc ist das Hauptdokument, childDocs die verknüpften Zusatz-LVs.
  const [mainDoc, setMainDoc] = useState(blankMainDoc);
  const [childDocs, setChildDocs] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1); // -1 = mainDoc, sonst Index in childDocs

  const [objekt, setObjekt] = useState('');
  const [datum, setDatum] = useState(todayISO());
  const [intervallInfo, setIntervallInfo] = useState('');
  const [customer, setCustomer] = useState(null);
  const [showSevDesk, setShowSevDesk] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showInspection, setShowInspection] = useState(false);
  const [showAICheckup, setShowAICheckup] = useState(false);
  const [aiStatus, setAiStatus] = useState('idle');
  const [aiIssues, setAiIssues] = useState([]);
  const [aiError, setAiError] = useState('');

  const [saveStatus, setSaveStatus] = useState('idle');

  const activeDoc = activeIndex === -1 ? mainDoc : childDocs[activeIndex];
  const sections = activeDoc?.sections || [];
  const lvTitle = activeDoc?.lvTitle || '';

  function setSections(updater) {
    const next = typeof updater === 'function' ? updater(sections) : updater;
    if (activeIndex === -1) {
      setMainDoc((d) => ({ ...d, sections: next }));
    } else {
      setChildDocs((docs) => docs.map((d, i) => (i === activeIndex ? { ...d, sections: next } : d)));
    }
  }

  function setLvTitle(title) {
    if (activeIndex === -1) {
      setMainDoc((d) => ({ ...d, lvTitle: title }));
    } else {
      setChildDocs((docs) => docs.map((d, i) => (i === activeIndex ? { ...d, lvTitle: title } : d)));
    }
  }

  function handleSetupGenerated({ sections: mainSections, children, customer: newCustomer }) {
    setMainDoc({ id: null, lvTitle: 'Leistungsverzeichnis Unterhaltsreinigung', sections: mainSections });
    setChildDocs(
      (children || []).map((c) => ({ id: null, docType: c.docType, lvTitle: c.lvTitle, sections: c.sections }))
    );
    setActiveIndex(-1);
    setCustomer(newCustomer);
    setObjekt(addressLine(newCustomer) || newCustomer?.name || '');
    setDatum(todayISO());
    setIntervallInfo('');
    setView('editor');
  }

  function addOptionalService(key) {
    const s = cloneOptionalSection(key);
    if (s) setSections((prev) => [...prev, s]);
  }

  function addSection() {
    setSections((prev) => [...prev, newSection()]);
  }

  async function handleSave() {
    setSaveStatus('saving');
    try {
      const mainPayload = {
        lvTitle: mainDoc.lvTitle,
        objekt,
        datum,
        intervallInfo,
        sections: mainDoc.sections,
        customer,
        docType: 'main',
      };
      let mainId = mainDoc.id;
      if (mainId) {
        await updateDocument(mainId, mainPayload);
      } else {
        const created = await createDocument(mainPayload);
        mainId = created.id;
        setMainDoc((d) => ({ ...d, id: mainId }));
      }

      const updatedChildren = await Promise.all(
        childDocs.map(async (c) => {
          const payload = {
            lvTitle: c.lvTitle,
            objekt,
            datum,
            intervallInfo,
            sections: c.sections,
            customer,
            docType: c.docType,
            parentId: mainId,
          };
          if (c.id) {
            await updateDocument(c.id, payload);
            return c;
          }
          const created = await createDocument(payload);
          return { ...c, id: created.id };
        })
      );
      setChildDocs(updatedChildren);

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      setSaveStatus('error');
    }
  }

  // Called by SevDeskModal once an offer was created in sevDesk, so the
  // link between this LV and the resulting Angebot survives a reload.
  // Persists into whichever document is currently active (mainDoc or a
  // childDoc) - not always mainDoc, since the offer may have been sent
  // from e.g. the Glasreinigung tab.
  async function handleOfferCreated(offerData) {
    try {
      const payload = {
        lvTitle,
        objekt,
        datum,
        intervallInfo,
        sections,
        customer,
        offer: offerData,
        ...(activeIndex !== -1 ? { parentId: mainDoc.id, docType: childDocs[activeIndex].docType } : {}),
      };
      if (activeDoc.id) {
        await updateDocument(activeDoc.id, payload);
      } else {
        const created = await createDocument(payload);
        if (activeIndex === -1) {
          setMainDoc((d) => ({ ...d, id: created.id }));
        } else {
          setChildDocs((docs) => docs.map((d, i) => (i === activeIndex ? { ...d, id: created.id } : d)));
        }
      }
    } catch (err) {
      // The offer already exists in sevDesk regardless; losing the local
      // link is not worth surfacing as an error here.
    }
  }

  async function handleOpenDocument(id) {
    try {
      const doc = await getDocument(id);
      const mainId = doc.parentId || doc.id;
      const main = doc.parentId ? await getDocument(mainId) : doc;

      const all = await listDocuments();
      const childSummaries = all.filter((d) => d.parentId === mainId);
      const children = await Promise.all(childSummaries.map((c) => getDocument(c.id)));

      setMainDoc({ id: main.id, lvTitle: main.lvTitle, sections: main.sections });
      setChildDocs(
        children.map((c) => ({ id: c.id, docType: c.docType, lvTitle: c.lvTitle, sections: c.sections }))
      );
      setObjekt(main.objekt);
      setDatum(main.datum);
      setIntervallInfo(main.intervallInfo);
      setCustomer(main.customer || null);
      setActiveIndex(doc.parentId ? children.findIndex((c) => c.id === doc.id) : -1);
      setView('editor');
    } catch (err) {
      alert(err?.message || 'Dokument konnte nicht geladen werden.');
    }
  }

  function handleNewDocument() {
    setView('setup');
  }

  function handleStartInspection() {
    setMainDoc(blankMainDoc());
    setChildDocs([]);
    setActiveIndex(-1);
    setCustomer(null);
    setObjekt('');
    setDatum(todayISO());
    setIntervallInfo('');
    setView('editor');
    setShowInspection(true);
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
      const filename = `${lvTitle || 'Leistungsverzeichnis'}_${safeObjekt}_${datum}.pdf`.replace(/\s+/g, '_');
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
  }, [objekt, datum, lvTitle]);

  if (view === 'overview') {
    return (
      <Overview
        variant="page"
        onOpen={handleOpenDocument}
        onNew={handleNewDocument}
        onInspect={handleStartInspection}
      />
    );
  }

  if (view === 'setup') {
    return <QuickSetup onGenerate={handleSetupGenerated} onCancel={() => setView('overview')} />;
  }

  return (
    <div className="app-shell">
      <div className="toolbar no-print">
        <div className="toolbar-group">
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
          <button onClick={handleSave} disabled={saveStatus === 'saving'}>
            {saveStatus === 'saving' ? 'Speichert...' : saveStatus === 'saved' ? '✓ Gespeichert' : 'Speichern'}
          </button>
          <button onClick={() => setView('overview')}>Übersicht</button>
        </div>
      </div>

      <div className="toolbar no-print">
        <div className="toolbar-group">
          <button onClick={() => setShowCustomerModal(true)}>
            Kunde: {customer?.name || 'nicht ausgewählt'}
          </button>
        </div>
        {childDocs.length > 0 && (
          <div className="toolbar-group doc-tabs">
            <button className={activeIndex === -1 ? 'doc-tab active' : 'doc-tab'} onClick={() => setActiveIndex(-1)}>
              Unterhaltsreinigung
            </button>
            {childDocs.map((c, i) => (
              <button
                key={c.docType}
                className={activeIndex === i ? 'doc-tab active' : 'doc-tab'}
                onClick={() => setActiveIndex(i)}
              >
                {c.lvTitle.replace('Leistungsverzeichnis ', '')}
              </button>
            ))}
          </div>
        )}
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
          initialContact={customer}
          onOfferCreated={handleOfferCreated}
        />
      )}

      {showCustomerModal && (
        <CustomerModal
          initialCustomer={customer}
          onSave={(c) => {
            setCustomer(c);
            if (c) setObjekt((prev) => prev || addressLine(c) || c.name || '');
          }}
          onClose={() => setShowCustomerModal(false)}
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

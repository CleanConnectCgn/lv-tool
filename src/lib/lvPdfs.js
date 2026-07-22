// Client for the server-side "Leistungsverzeichnisse" PDF folder
// (see server/index.js /api/lv-pdfs routes).

export async function listLvPdfs() {
  const res = await fetch('/api/lv-pdfs');
  const data = await res.json().catch(() => ([]));
  if (!res.ok) throw new Error(data?.error || 'Liste konnte nicht geladen werden');
  return data;
}

export async function uploadLvPdf(blob, filename) {
  const res = await fetch('/api/lv-pdfs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/pdf',
      'X-Filename': encodeURIComponent(filename),
    },
    body: blob,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'PDF konnte nicht abgelegt werden');
  return data;
}

export function lvPdfDownloadUrl(filename) {
  return `/api/lv-pdfs/${encodeURIComponent(filename)}`;
}

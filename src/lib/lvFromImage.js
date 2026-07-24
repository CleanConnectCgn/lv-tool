// Client for POST /api/lv/from-image (Gemini Vision LV-Erkennung aus Foto/PDF).

const INTERVAL_MAP = {
  taeglich: { column: 'woechentlich', value: '7x' },
  '2x_woechentlich': { column: 'woechentlich', value: '2x' },
  woechentlich: { column: 'woechentlich', value: '1x' },
  '14taegig': { column: 'monatlich', value: '2x' },
  monatlich: { column: 'monatlich', value: '1x' },
  quartalsweise: { column: 'jaehrlich', value: '4x' },
  nach_bedarf: { bedarf: true },
};

let idCounter = 1;
const uid = () => `img${idCounter++}-${Math.random().toString(36).slice(2, 8)}`;

export async function analyzeLvFile(file) {
  const buffer = await file.arrayBuffer();
  const res = await fetch(`/api/lv/from-image?mimeType=${encodeURIComponent(file.type)}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: buffer,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw new Error(data?.error || 'Analyse fehlgeschlagen');
  return data;
}

// Wandelt das Gemini-Analyseergebnis in Sections im bestehenden LV-Datenmodell um.
export function analysisToSections(analysis) {
  return (analysis?.bereiche || []).map((bereich) => ({
    id: uid(),
    title: bereich.name || 'Bereich',
    rows: (bereich.positionen || []).map((pos) => {
      const mapped = INTERVAL_MAP[pos.intervall] || {};
      return {
        id: uid(),
        text: pos.leistung || '',
        bedarf: !!mapped.bedarf,
        intervalColumn: mapped.bedarf ? '' : mapped.column || '',
        intervalValue: mapped.bedarf ? '' : mapped.value || '',
        bemerkung: pos.bemerkung || '',
        wochentage: Array.isArray(pos.wochentage) ? pos.wochentage : [],
      };
    }),
  }));
}

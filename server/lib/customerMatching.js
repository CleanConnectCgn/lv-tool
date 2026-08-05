// Findet für einen von der KI ausgelesenen Kundennamen (Posteingang, siehe
// server/lib/inbox.js) die wahrscheinlichsten bestehenden Kunden. Bewusst
// kein Volltext-/Trigram-Index (Postgres pg_trgm o.ä.) - die Kundenzahl ist
// klein genug, um bei jeder Zuordnung einfach alle Kunden im Speicher zu
// vergleichen, ohne zusätzliche Infrastruktur.
import { prisma } from './prisma.js';

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // Umlaute/Akzente auf Basisbuchstaben reduzieren
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Levenshtein-Distanz, klassische DP-Implementierung - für Kundennamen
// (wenige Wörter) schnell genug, keine Bibliothek nötig.
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Ähnlichkeits-Score 0..1 (1 = identisch). Enthält der eine String den
// anderen komplett (z.B. "Modern Mona Lisa GmbH" enthält "Modern Mona
// Lisa"), gilt das als sehr starkes Signal unabhängig von der Länge.
function similarity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return Math.max(0, 1 - dist / maxLen);
}

// Liefert bis zu 3 Kandidaten mit Score (0..1), absteigend sortiert.
// extractedAddress fließt nur als leichter Bonus ein (Straße im Namen
// ist selten, aber falls die KI z.B. den Ort mit ausliest, hilft es bei
// mehrdeutigen Namen).
export async function findCustomerMatches(extractedName, extractedAddress) {
  if (!extractedName?.trim()) return [];
  const customers = await prisma.customer.findMany({
    select: { id: true, name: true, street: true, city: true },
  });

  const scored = customers.map((c) => {
    let score = similarity(extractedName, c.name);
    if (extractedAddress && c.city && normalize(extractedAddress).includes(normalize(c.city))) {
      score = Math.min(1, score + 0.05);
    }
    return { customerId: c.id, name: c.name, score: Math.round(score * 100) / 100 };
  });

  return scored
    .filter((s) => s.score >= 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

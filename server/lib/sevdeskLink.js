// Block 6: Kundenverknüpfung - gleicht sevDesk-Kontakte gegen die neuen
// Postgres-Kunden (Block 5) ab. Liest sevDesk NUR (GET) - passt zur
// harten Regel, dass das Tool in sevDesk nie etwas ändern/löschen darf;
// hier wird ausschließlich unser eigenes customers.sevdesk_contact_id
// geschrieben.
import fetch from 'node-fetch';
import { prisma } from './prisma.js';

const SEVDESK_BASE = 'https://my.sevdesk.de/api/v1';

async function sevGet(token, path) {
  const res = await fetch(`${SEVDESK_BASE}${path}`, { headers: { Authorization: token } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || data?.message || `sevDesk-Fehler (${res.status})`);
  return data;
}

function domainOf(email) {
  const at = (email || '').split('@')[1];
  return at ? at.toLowerCase() : null;
}

// Rechtsform-Wörter werden beim Namensvergleich ignoriert, damit "Muster
// GmbH" und "Muster UG" nicht allein deswegen als unähnlich gelten.
const LEGAL_FORM_WORDS = new Set(['gmbh', 'ug', 'ag', 'kg', 'ohg', 'gbr', 'ev', 'co', 'mbh', 'haftungsbeschraenkt']);

function normalizeNameWords(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[.,&()-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !LEGAL_FORM_WORDS.has(w));
}

// Jaccard-Ähnlichkeit über die (rechtsform-bereinigten) Wortmengen - bewusst
// simpel statt einer vollen Fuzzy-Matching-Library, da dieses Signal laut
// Auftrag ohnehin NIEMALS automatisch verknüpfen darf, nur als schwacher
// Vorschlag dient.
function nameSimilarity(a, b) {
  const wordsA = new Set(normalizeNameWords(a));
  const wordsB = new Set(normalizeNameWords(b));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

// sevDesk hat kein Email-Feld direkt am Contact - E-Mails hängen als
// CommunicationWay-Unterobjekte dran. Ein Bulk-Abruf (type=EMAIL, paginiert)
// ist erheblich günstiger als ein Request pro Kontakt (live gegen die echte
// API geprüft: funktioniert ohne contact-Filter).
export async function fetchSevDeskContactsWithEmail(token) {
  const contactsData = await sevGet(token, '/Contact?limit=1000');
  const contacts = contactsData.objects || [];

  const emailMap = new Map();
  let offset = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await sevGet(token, `/CommunicationWay?type=EMAIL&limit=100&offset=${offset}`);
    const rows = page.objects || [];
    for (const row of rows) {
      if (row.contact?.id && row.value) emailMap.set(row.contact.id, row.value.toLowerCase());
    }
    if (rows.length < 100) break;
    offset += 100;
  }

  return contacts.map((c) => ({
    id: c.id,
    name: c.name || `${c.surename || ''} ${c.familyname || ''}`.trim(),
    email: emailMap.get(c.id) || null,
  }));
}

// Reine Klassifizierungslogik, ohne I/O - separat testbar ohne echte
// sevDesk-/DB-Aufrufe. customers/sevContacts: siehe Aufrufer.
// takenSevIds: bereits verknüpfte sevDesk-Kontakt-IDs (werden während des
// Laufs live ergänzt, sobald ein E-Mail-Treffer automatisch verknüpft wird -
// verhindert, dass derselbe sevDesk-Kontakt zweimal vergeben wird).
export function categorizeMatches(customers, sevContacts, takenSevIds = new Set()) {
  const taken = new Set(takenSevIds);
  const autoLinked = [];
  const suggestions = [];

  for (const customer of customers) {
    for (const contact of sevContacts) {
      if (taken.has(contact.id)) continue; // sevdesk_contact_id ist @unique

      const customerEmail = (customer.email || '').toLowerCase();
      const contactEmail = (contact.email || '').toLowerCase();

      if (customerEmail && contactEmail && customerEmail === contactEmail) {
        autoLinked.push({
          customerId: customer.id,
          customerName: customer.name,
          sevdeskContactId: contact.id,
          contactName: contact.name,
          reason: 'email_exact',
        });
        taken.add(contact.id);
        continue;
      }

      const customerDomain = domainOf(customerEmail);
      const contactDomain = domainOf(contactEmail);
      if (customerDomain && contactDomain && customerDomain === contactDomain) {
        suggestions.push({
          customerId: customer.id,
          customerName: customer.name,
          sevdeskContactId: contact.id,
          contactName: contact.name,
          reason: 'same_domain',
        });
        continue;
      }

      const similarity = nameSimilarity(customer.name, contact.name);
      if (similarity >= 0.5) {
        suggestions.push({
          customerId: customer.id,
          customerName: customer.name,
          sevdeskContactId: contact.id,
          contactName: contact.name,
          reason: 'similar_name',
          similarity: Math.round(similarity * 100) / 100,
        });
      }
    }
  }

  return { autoLinked, suggestions };
}

// Kategorisiert Übereinstimmungen zwischen sevDesk-Kontakten und noch nicht
// verknüpften customers:
//   - E-Mail exakt gleich          -> SOFORT verknüpft (autoLinked)
//   - gleiche Firmendomain, andere E-Mail -> nur Vorschlag (suggestions)
//   - nur ähnlicher Firmenname     -> nur Vorschlag, NIEMALS automatisch
export async function matchAndAutoLink(token) {
  const [sevContacts, unlinkedCustomers, linkedRows] = await Promise.all([
    fetchSevDeskContactsWithEmail(token),
    prisma.customer.findMany({ where: { sevdeskContactId: null } }),
    prisma.customer.findMany({ where: { sevdeskContactId: { not: null } }, select: { sevdeskContactId: true } }),
  ]);
  const takenSevIds = new Set(linkedRows.map((c) => c.sevdeskContactId));

  const { autoLinked, suggestions } = categorizeMatches(unlinkedCustomers, sevContacts, takenSevIds);

  for (const link of autoLinked) {
    await prisma.customer.update({ where: { id: link.customerId }, data: { sevdeskContactId: link.sevdeskContactId } });
  }

  return { autoLinked, suggestions };
}

export function registerSevdeskLinkRoutes(app) {
  app.post('/api/db/sevdesk-link/run', async (req, res) => {
    const token = process.env.SEVDESK_TOKEN;
    if (!token) return res.status(500).json({ error: 'SEVDESK_TOKEN ist nicht konfiguriert' });
    try {
      const result = await matchAndAutoLink(token);
      res.json(result);
    } catch (err) {
      res.status(502).json({ error: err?.message || 'sevDesk-Abgleich fehlgeschlagen' });
    }
  });

  // Manuelle Bestätigung eines Vorschlags (same_domain/similar_name) - oder
  // generell eine manuelle Verknüpfung unabhängig vom Abgleich.
  app.post('/api/db/sevdesk-link/confirm', async (req, res) => {
    const { customerId, sevdeskContactId } = req.body || {};
    if (!customerId || !sevdeskContactId) {
      return res.status(400).json({ error: 'customerId und sevdeskContactId sind erforderlich' });
    }
    try {
      const updated = await prisma.customer.update({
        where: { id: customerId },
        data: { sevdeskContactId: String(sevdeskContactId) },
      });
      res.json(updated);
    } catch (err) {
      // P2002: unique constraint verletzt - der sevDesk-Kontakt ist bereits
      // mit einem ANDEREN Kunden verknüpft.
      if (err?.code === 'P2002') {
        return res.status(409).json({ error: 'Dieser sevDesk-Kontakt ist bereits mit einem anderen Kunden verknüpft' });
      }
      res.status(err?.code === 'P2025' ? 404 : 500).json({ error: err?.message || 'Verknüpfung fehlgeschlagen' });
    }
  });

  // "Jede Verknüpfung muss sich wieder lösen lassen."
  app.delete('/api/db/sevdesk-link/:customerId', async (req, res) => {
    try {
      const updated = await prisma.customer.update({
        where: { id: req.params.customerId },
        data: { sevdeskContactId: null },
      });
      res.json(updated);
    } catch (err) {
      res.status(err?.code === 'P2025' ? 404 : 500).json({ error: err?.message || 'Trennen fehlgeschlagen' });
    }
  });
}

// Block 5: Kundenmaske und Objekte, gegen die neue Postgres-Datenbank
// (Prisma, Block 2) - bewusst unter einem eigenen Präfix (/api/db/*), klar
// getrennt vom bestehenden dateibasierten CRM (/api/crm/*), das unverändert
// weiterläuft, bis Block 9 die alten Daten migriert. Wird hinter dem
// bestehenden Google-Login-Gate registriert (siehe server/index.js).
import { prisma } from './prisma.js';

// "Straße, PLZ Ort" - dieselbe Reihenfolge, in der Adressen im übrigen Tool
// bereits angezeigt werden (siehe addressLine()-Hilfsfunktionen im
// Frontend), damit die Sammelanlage intuitiv nutzbar ist.
function parseAddressLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const commaIdx = trimmed.indexOf(',');
  if (commaIdx === -1) return { error: `Kein Komma gefunden - Format: Straße, PLZ Ort` };
  const street = trimmed.slice(0, commaIdx).trim();
  const rest = trimmed.slice(commaIdx + 1).trim();
  const spaceIdx = rest.indexOf(' ');
  if (!street || spaceIdx === -1) return { error: `Format: Straße, PLZ Ort` };
  const zip = rest.slice(0, spaceIdx).trim();
  const city = rest.slice(spaceIdx + 1).trim();
  if (!zip || !city) return { error: `Format: Straße, PLZ Ort` };
  return { street, zip, city };
}

const SPEC_ITEM_INCLUDE = { items: { include: { catalogItem: true, roomArea: true }, orderBy: { sortOrder: 'asc' } } };

export function registerDbCrmRoutes(app) {
  // ---- Kunden ----

  app.get('/api/db/customers', async (req, res) => {
    try {
      const rows = await prisma.customer.findMany({
        include: { objects: true },
        orderBy: { createdAt: 'desc' },
      });
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Kunden konnten nicht geladen werden' });
    }
  });

  app.get('/api/db/customers/:id', async (req, res) => {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: req.params.id },
        include: { objects: { orderBy: { sortOrder: 'asc' } } },
      });
      if (!customer) return res.status(404).json({ error: 'Kunde nicht gefunden' });
      res.json(customer);
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Kunde konnte nicht geladen werden' });
    }
  });

  // "Einen Kunden ohne Objekt darf es nicht geben" - Kunde + (mindestens)
  // ein Objekt werden in EINER Transaktion angelegt: schlägt das Objekt
  // fehl, entsteht auch kein Kunde. Der Haken "Rechnungsadresse gleich
  // Objektadresse" kopiert dabei NUR die Adresse, das Objekt wird trotzdem
  // immer als eigener Datensatz angelegt.
  app.post('/api/db/customers', async (req, res) => {
    const { name, street, zip, city, email, contactPerson, paymentTermDays, sameAsObjectAddress, firstObject } =
      req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Firmenname ist erforderlich' });
    }
    const objStreet = sameAsObjectAddress ? street : firstObject?.street;
    const objZip = sameAsObjectAddress ? zip : firstObject?.zip;
    const objCity = sameAsObjectAddress ? city : firstObject?.city;
    if (!objStreet || !objZip || !objCity) {
      return res.status(400).json({
        error:
          'Objektadresse (Straße, PLZ, Ort) ist erforderlich - entweder per Haken "Rechnungsadresse gleich Objektadresse" oder eigene Angabe',
      });
    }
    try {
      const result = await prisma.$transaction(async (tx) => {
        const customer = await tx.customer.create({
          data: {
            name: name.trim(),
            street: street || null,
            zip: zip || null,
            city: city || null,
            email: email || null,
            contactPerson: contactPerson || null,
            paymentTermDays: paymentTermDays != null && paymentTermDays !== '' ? Number(paymentTermDays) : null,
          },
        });
        const object = await tx.property.create({
          data: {
            customerId: customer.id,
            street: objStreet,
            zip: objZip,
            city: objCity,
            label: (firstObject?.label && firstObject.label.trim()) || objStreet,
            contactPersonOnSite: firstObject?.contactPersonOnSite || null,
            accessNote: firstObject?.accessNote || null,
          },
        });
        return { customer, object };
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Kunde konnte nicht angelegt werden' });
    }
  });

  app.put('/api/db/customers/:id', async (req, res) => {
    try {
      const data = {};
      ['name', 'street', 'zip', 'city', 'email', 'contactPerson'].forEach((k) => {
        if (req.body?.[k] !== undefined) data[k] = req.body[k];
      });
      if (req.body?.paymentTermDays !== undefined) {
        data.paymentTermDays = req.body.paymentTermDays === '' ? null : Number(req.body.paymentTermDays);
      }
      const updated = await prisma.customer.update({ where: { id: req.params.id }, data });
      res.json(updated);
    } catch (err) {
      res.status(err?.code === 'P2025' ? 404 : 500).json({ error: err?.message || 'Kunde konnte nicht aktualisiert werden' });
    }
  });

  // ---- Objekte ----

  app.get('/api/db/objects', async (req, res) => {
    try {
      const where = req.query.customerId ? { customerId: req.query.customerId } : {};
      const rows = await prisma.property.findMany({ where, orderBy: { sortOrder: 'asc' } });
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Objekte konnten nicht geladen werden' });
    }
  });

  app.get('/api/db/objects/:id', async (req, res) => {
    try {
      const object = await prisma.property.findUnique({ where: { id: req.params.id }, include: { customer: true } });
      if (!object) return res.status(404).json({ error: 'Objekt nicht gefunden' });
      res.json(object);
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Objekt konnte nicht geladen werden' });
    }
  });

  app.post('/api/db/objects', async (req, res) => {
    const { customerId, street, zip, city, label, contactPersonOnSite, accessNote } = req.body || {};
    if (!customerId || !street || !zip || !city) {
      return res.status(400).json({ error: 'customerId, street, zip und city sind erforderlich' });
    }
    try {
      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) return res.status(404).json({ error: 'Kunde nicht gefunden' });
      const object = await prisma.property.create({
        data: {
          customerId,
          street,
          zip,
          city,
          label: (label && label.trim()) || street,
          contactPersonOnSite: contactPersonOnSite || null,
          accessNote: accessNote || null,
        },
      });
      res.status(201).json(object);
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Objekt konnte nicht angelegt werden' });
    }
  });

  // Sammelanlage: ein mehrzeiliges Adressfeld, eine Adresse je Zeile.
  // Nicht parsebare Zeilen werden übersprungen und mit Grund zurückgemeldet,
  // statt sie stillschweigend zu verwerfen.
  app.post('/api/db/customers/:id/objects/bulk', async (req, res) => {
    const { addresses } = req.body || {};
    if (!addresses || typeof addresses !== 'string') {
      return res.status(400).json({ error: 'addresses (mehrzeiliger Text) ist erforderlich' });
    }
    try {
      const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
      if (!customer) return res.status(404).json({ error: 'Kunde nicht gefunden' });

      const lines = addresses
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const created = [];
      const failed = [];
      for (const line of lines) {
        const parsed = parseAddressLine(line);
        if (!parsed || parsed.error) {
          failed.push({ line, reason: parsed?.error || 'Unbekanntes Format' });
          continue;
        }
        const object = await prisma.property.create({
          data: { customerId: customer.id, street: parsed.street, zip: parsed.zip, city: parsed.city, label: parsed.street },
        });
        created.push(object);
      }
      res.status(created.length ? 201 : 400).json({ created, failed });
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Sammelanlage fehlgeschlagen' });
    }
  });

  app.put('/api/db/objects/:id', async (req, res) => {
    try {
      const data = {};
      ['street', 'zip', 'city', 'label', 'contactPersonOnSite', 'accessNote', 'sortOrder'].forEach((k) => {
        if (req.body?.[k] !== undefined) data[k] = req.body[k];
      });
      const updated = await prisma.property.update({ where: { id: req.params.id }, data });
      res.json(updated);
    } catch (err) {
      res.status(err?.code === 'P2025' ? 404 : 500).json({ error: err?.message || 'Objekt konnte nicht aktualisiert werden' });
    }
  });

  // "Einen Kunden ohne Objekt darf es nicht geben" gilt auch beim Löschen -
  // das letzte Objekt eines Kunden kann nicht entfernt werden.
  app.delete('/api/db/objects/:id', async (req, res) => {
    try {
      const object = await prisma.property.findUnique({ where: { id: req.params.id } });
      if (!object) return res.status(404).json({ error: 'Objekt nicht gefunden' });
      const count = await prisma.property.count({ where: { customerId: object.customerId } });
      if (count <= 1) {
        return res
          .status(409)
          .json({ error: 'Letztes Objekt eines Kunden kann nicht gelöscht werden - ein Kunde braucht mindestens ein Objekt.' });
      }
      await prisma.property.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Objekt konnte nicht gelöscht werden' });
    }
  });

  // ---- Leistungskatalog (nur lesend) ----

  app.get('/api/db/room-areas', async (req, res) => {
    try {
      res.json(await prisma.roomArea.findMany({ orderBy: { sortOrder: 'asc' } }));
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Raumbereiche konnten nicht geladen werden' });
    }
  });

  app.get('/api/db/element-groups', async (req, res) => {
    try {
      res.json(await prisma.elementGroup.findMany({ orderBy: { sortOrder: 'asc' } }));
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Elementgruppen konnten nicht geladen werden' });
    }
  });

  app.get('/api/db/catalog', async (req, res) => {
    try {
      const where = { aktiv: true, ...(req.query.elementGroupId ? { elementGroupId: req.query.elementGroupId } : {}) };
      const rows = await prisma.serviceCatalogItem.findMany({
        where,
        include: { elementGroup: true },
        orderBy: { gegenstand: 'asc' },
      });
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Katalog konnte nicht geladen werden' });
    }
  });

  // "Nur ein Mensch legt Katalogpunkte an" (Block 7) - dieser Endpunkt wird
  // ausschließlich von der Review-Oberfläche aufgerufen (nicht zuordenbare
  // Zeile -> "Als neuen Katalogpunkt anlegen"), NIEMALS vom Auslese-Adapter
  // selbst.
  app.post('/api/db/catalog', async (req, res) => {
    const { elementGroupId, gegenstand, verb, zusatz, synonyme } = req.body || {};
    if (!elementGroupId || !gegenstand || !verb) {
      return res.status(400).json({ error: 'elementGroupId, gegenstand und verb sind erforderlich' });
    }
    try {
      const item = await prisma.serviceCatalogItem.create({
        data: {
          elementGroupId,
          gegenstand,
          verb,
          zusatz: zusatz || null,
          synonyme: Array.isArray(synonyme) ? synonyme : [],
        },
        include: { elementGroup: true },
      });
      res.status(201).json(item);
    } catch (err) {
      // z.B. ungültiger verb-Wert (Prisma-Enum lehnt alles außerhalb der
      // geschlossenen Verbliste hart ab).
      res.status(400).json({ error: err?.message || 'Katalogpunkt konnte nicht angelegt werden' });
    }
  });

  // ---- Leistungsverzeichnisse (ServiceSpec) je Objekt ----

  app.get('/api/db/objects/:id/service-specs', async (req, res) => {
    try {
      const specs = await prisma.serviceSpec.findMany({
        where: { objectId: req.params.id },
        include: SPEC_ITEM_INCLUDE,
        orderBy: { createdAt: 'desc' },
      });
      res.json(specs);
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Leistungsverzeichnisse konnten nicht geladen werden' });
    }
  });

  app.post('/api/db/objects/:id/service-specs', async (req, res) => {
    const { leistungsart, standDatum, items } = req.body || {};
    if (!leistungsart || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'leistungsart und mindestens ein Item sind erforderlich' });
    }
    // "Ein Item ohne Katalogverweis ist nicht speicherbar" (Auftrag Block 2).
    if (items.some((it) => !it?.catalogItemId || !it?.roomAreaId)) {
      return res.status(400).json({ error: 'Jedes Item braucht catalogItemId und roomAreaId' });
    }
    try {
      const object = await prisma.property.findUnique({ where: { id: req.params.id } });
      if (!object) return res.status(404).json({ error: 'Objekt nicht gefunden' });

      const lastVersion = await prisma.serviceSpec.findFirst({
        where: { objectId: object.id, leistungsart },
        orderBy: { version: 'desc' },
      });

      const spec = await prisma.serviceSpec.create({
        data: {
          objectId: object.id,
          leistungsart,
          version: (lastVersion?.version || 0) + 1,
          standDatum: standDatum ? new Date(standDatum) : new Date(),
          items: {
            create: items.map((it, i) => ({
              catalogItemId: it.catalogItemId,
              roomAreaId: it.roomAreaId,
              nachBedarf: !!it.nachBedarf,
              einmalig: !!it.einmalig,
              woechentlich: it.woechentlich != null && it.woechentlich !== '' ? Number(it.woechentlich) : null,
              monatlich: it.monatlich != null && it.monatlich !== '' ? Number(it.monatlich) : null,
              jaehrlich: it.jaehrlich != null && it.jaehrlich !== '' ? Number(it.jaehrlich) : null,
              bemerkung: it.bemerkung || null,
              sortOrder: i,
            })),
          },
        },
        include: SPEC_ITEM_INCLUDE,
      });
      res.status(201).json(spec);
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Leistungsverzeichnis konnte nicht angelegt werden' });
    }
  });

  app.put('/api/db/service-specs/:specId/items/:itemId', async (req, res) => {
    try {
      const existing = await prisma.serviceSpecItem.findUnique({ where: { id: req.params.itemId } });
      if (!existing || existing.serviceSpecId !== req.params.specId) {
        return res.status(404).json({ error: 'Item nicht gefunden' });
      }
      const data = {};
      ['nachBedarf', 'einmalig', 'woechentlich', 'monatlich', 'jaehrlich', 'bemerkung', 'roomAreaId', 'catalogItemId'].forEach((k) => {
        if (req.body?.[k] !== undefined) data[k] = req.body[k];
      });
      const updated = await prisma.serviceSpecItem.update({
        where: { id: req.params.itemId },
        data,
        include: { catalogItem: true, roomArea: true },
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Item konnte nicht aktualisiert werden' });
    }
  });

  // "Leistungsverzeichnis auf andere Objekte übertragen": Mehrfachauswahl
  // an Ziel-Objekten, jedes bekommt eine EIGENE Kopie von Spec + Items -
  // "danach je Objekt einzeln bearbeitbar" ist dadurch automatisch erfüllt,
  // weil es getrennte Datensätze sind (Änderungen an der einen Kopie
  // wirken sich nie auf eine andere aus).
  app.post('/api/db/service-specs/:id/transfer', async (req, res) => {
    const { targetObjectIds } = req.body || {};
    if (!Array.isArray(targetObjectIds) || targetObjectIds.length === 0) {
      return res.status(400).json({ error: 'targetObjectIds (Array) ist erforderlich' });
    }
    try {
      const source = await prisma.serviceSpec.findUnique({ where: { id: req.params.id }, include: { items: true } });
      if (!source) return res.status(404).json({ error: 'Leistungsverzeichnis nicht gefunden' });

      const targets = await prisma.property.findMany({ where: { id: { in: targetObjectIds } } });
      if (targets.length !== targetObjectIds.length) {
        return res.status(404).json({ error: 'Mindestens ein Ziel-Objekt wurde nicht gefunden' });
      }

      const createdSpecs = [];
      for (const target of targets) {
        const lastVersion = await prisma.serviceSpec.findFirst({
          where: { objectId: target.id, leistungsart: source.leistungsart },
          orderBy: { version: 'desc' },
        });
        const spec = await prisma.serviceSpec.create({
          data: {
            objectId: target.id,
            leistungsart: source.leistungsart,
            version: (lastVersion?.version || 0) + 1,
            standDatum: new Date(),
            items: {
              create: source.items.map((it) => ({
                catalogItemId: it.catalogItemId,
                roomAreaId: it.roomAreaId,
                nachBedarf: it.nachBedarf,
                einmalig: it.einmalig,
                woechentlich: it.woechentlich,
                monatlich: it.monatlich,
                jaehrlich: it.jaehrlich,
                bemerkung: it.bemerkung,
                sortOrder: it.sortOrder,
              })),
            },
          },
          include: SPEC_ITEM_INCLUDE,
        });
        createdSpecs.push(spec);
      }
      res.status(201).json({ createdSpecs });
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Übertragung fehlgeschlagen' });
    }
  });
}

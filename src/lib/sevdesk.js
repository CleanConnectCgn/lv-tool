// Thin client for the sevDesk API, routed through our server proxy at
// /api/sevdesk/request to avoid browser CORS restrictions.
//
// Note: sevDesk has no separate "Offer" resource. Angebote are stored as
// /Order documents with orderType "AN" (bestaetigt by GET /Order/Factory/
// getNextOrderNumber?orderType=AN and by POST /Offer returning
// "Model_Offer not found").
//
// The sevDesk API expects form-encoded bodies (application/x-www-form-urlencoded)
// for the Factory endpoints, not JSON. Those calls go through
// /api/sevdesk/form-request, which flattens and form-encodes the params server-side.

async function sevRequest(token, method, path, body) {
  const res = await fetch('/api/sevdesk/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, method, path, body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    const message = data?.error?.message || data?.error || data?.message || `sevDesk Fehler (${res.status})`;
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }
  return data;
}

async function sevFormRequest(token, path, params) {
  const res = await fetch('/api/sevdesk/form-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, path, params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    const message = data?.error?.message || data?.error || data?.message || `sevDesk Fehler (${res.status})`;
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }
  return data;
}

export async function searchContacts(token, query) {
  if (!query || query.trim().length < 2) return [];
  const data = await sevRequest(token, 'GET', `/Contact?depth=1&limit=100`);
  const list = data?.objects ?? [];
  const q = query.trim().toLowerCase();
  return list
    .map((c) => ({
      id: c.id,
      name: (c.name || `${c.surename || ''} ${c.familyname || ''}`.trim()),
      city: c.addresses?.[0]?.city || '',
      gender: c.gender || null,
      familyname: c.familyname || null,
    }))
    .filter((c) => c.name.toLowerCase().includes(q));
}

export async function createContact(token, { name, street, zip, city, email }) {
  const data = await sevRequest(token, 'POST', '/Contact', {
    name,
    category: { id: 3, objectName: 'Category' },
    status: 100,
  });
  const contact = data?.objects;
  if (!contact?.id) return contact;

  if (street || zip || city) {
    await sevRequest(token, 'POST', '/ContactAddress', {
      contact: { id: contact.id, objectName: 'Contact' },
      street: street || '',
      zip: zip || '',
      city: city || '',
      country: { id: 1, objectName: 'StaticCountry' },
    }).catch(() => {});
  }

  if (email) {
    await sevRequest(token, 'POST', '/CommunicationWay', {
      contact: { id: contact.id, objectName: 'Contact' },
      type: 'EMAIL',
      value: email,
      key: { id: 1, objectName: 'CommunicationWayKey' },
      main: true,
    }).catch(() => {});
  }

  return contact;
}

let cachedSevUserId = null;

async function getSevUserId(token) {
  if (cachedSevUserId) return cachedSevUserId;
  const data = await sevRequest(token, 'GET', '/SevUser?limit=1');
  const user = (data?.objects ?? data ?? [])[0];
  cachedSevUserId = user?.id || null;
  return cachedSevUserId;
}

// Real, sequential sevDesk offer number, e.g. "AN-1275".
export async function getNextOfferNumber(token) {
  const data = await sevRequest(token, 'GET', '/Order/Factory/getNextOrderNumber?orderType=AN');
  return data?.objects || null;
}

function isGlasSection(title) {
  const t = (title || '').toLowerCase();
  return t.includes('glas') || t.includes('lamell');
}

function formatDateDE(isoStr) {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-');
  return `${d}.${m}.${y}`;
}

// Kurzer Positionstext fürs Angebot: Preisart, Intervall, Objekt, Verweis
// auf das beigefügte Leistungsverzeichnis - nicht der komplette LV-Inhalt.
function positionText({ priceLabel, intervalLabel, objekt, standDatum }) {
  return [
    priceLabel,
    `→ Reinigungsintervall: ${intervalLabel}`,
    `→ Objekt: ${objekt || 'Objekt'}`,
    `→ Gemäß beigefügtem Leistungsverzeichnis (Stand: ${formatDateDE(standDatum)})`,
  ].join('\n');
}

export async function createOffer(token, {
  contactId,
  header,
  headText,
  footText,
  offerNumber,
  offerDate,
  timeToPay,
  sections,
  nettobetragUHR,
  nettobetragGlas,
  objekt,
  intervallInfo,
  standDatum,
}) {
  const userId = await getSevUserId(token).catch(() => null);
  const orderDate = Math.floor((offerDate ? new Date(offerDate) : new Date()).getTime() / 1000);

  const uhrSections = (sections || []).filter((s) => !isGlasSection(s.title));
  const glasSections = (sections || []).filter((s) => isGlasSection(s.title));

  const orderPosSave = [];
  if (uhrSections.length > 0) {
    orderPosSave.push({
      objectName: 'OrderPos',
      mapAll: 'true',
      name: 'Unterhaltsreinigung',
      text: positionText({
        priceLabel: 'Monatlicher Pauschalpreis',
        intervalLabel: intervallInfo || 'laut Leistungsverzeichnis',
        objekt,
        standDatum,
      }),
      price: Number(nettobetragUHR) || 0,
      priceNet: Number(nettobetragUHR) || 0,
      quantity: 1,
      unity: { id: '9', objectName: 'Unity' },
      taxRate: 19,
      positionNumber: 1,
      discount: 0,
    });
  }
  if (glasSections.length > 0) {
    orderPosSave.push({
      objectName: 'OrderPos',
      mapAll: 'true',
      name: 'Glasreinigung',
      text: positionText({
        priceLabel: 'Pauschalpreis pro Einsatz',
        intervalLabel: 'auf Anfrage',
        objekt,
        standDatum,
      }),
      price: Number(nettobetragGlas) || 0,
      priceNet: Number(nettobetragGlas) || 0,
      quantity: 1,
      unity: { id: '9', objectName: 'Unity' },
      taxRate: 19,
      positionNumber: 2,
      discount: 0,
      optional: true,
    });
  }

  // Fallback: mindestens eine Dummy-Position damit sevDesk nicht abbricht
  if (orderPosSave.length === 0) {
    orderPosSave.push({
      objectName: 'OrderPos',
      mapAll: 'true',
      name: 'Reinigungsleistungen',
      text: '',
      price: 0,
      priceNet: 0,
      quantity: 1,
      unity: { id: '9', objectName: 'Unity' },
      taxRate: 19,
      positionNumber: 1,
      discount: 0,
    });
  }

  const orderParams = {
    order: {
      objectName: 'Order',
      mapAll: 'true',
      orderType: 'AN',
      orderNumber: offerNumber,
      orderDate,
      contact: { id: contactId, objectName: 'Contact' },
      status: 100,
      header,
      headText,
      footText,
      version: 0,
      smallSettlement: false,
      taxRate: 0,
      taxText: '0',
      currency: 'EUR',
      showNet: true,
      taxRule: { id: '1', objectName: 'TaxRule' },
      propertyUseNewCalculation: 1,
      ...(userId ? { contactPerson: { id: userId, objectName: 'SevUser' } } : {}),
    },
    orderPosSave,
    orderPosDelete: null,
  };

  const data = await sevFormRequest(token, '/Order/Factory/saveOrder', orderParams);
  return data?.objects?.order || data?.objects || data;
}

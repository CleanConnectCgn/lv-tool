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
  if (!query || !query.trim()) return [];
  const data = await sevRequest(token, 'GET', `/Contact?depth=1&limit=50`);
  const list = data?.objects ?? data ?? [];
  const q = query.trim().toLowerCase();
  return list
    .map((c) => ({
      id: c.id,
      name: c.name || `${c.surename || ''} ${c.familyname || ''}`.trim(),
      city: c.addresses?.[0]?.city || '',
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

export async function createOffer(token, { contactId, header, headText, footText, offerNumber, offerDate, deliveryDate, timeToPay }) {
  const userId = await getSevUserId(token).catch(() => null);
  const orderDate = Math.floor((offerDate ? new Date(offerDate) : new Date()).getTime() / 1000);

  const orderParams = {
    order: {
      objectName: 'Order',
      mapAll: 'true',
      orderType: 'AN',
      orderDate,
      contact: { id: contactId, objectName: 'Contact' },
      status: 100,
      header,
      headText,
      footText,
      addressCountry: { id: 1, objectName: 'StaticCountry' },
      version: 0,
      smallSettlement: false,
      taxRate: 0,
      taxText: '0',
      currency: 'EUR',
      showNet: true,
      taxRule: { id: '1', objectName: 'TaxRule' },
      propertyUseNewCalculation: 1,
    },
  };
  if (userId) orderParams.order.contactPerson = { id: userId, objectName: 'SevUser' };

  const data = await sevFormRequest(token, '/Order/Factory/saveOrder', orderParams);
  return data?.objects?.order || data?.objects || data;
}

export async function createOfferPos(token, { offerId, name, text, quantity = 1, price = 0, positionNumber = 1 }) {
  const data = await sevFormRequest(token, '/Order/Factory/saveOrder', {
    order: { id: offerId, objectName: 'Order' },
    orderPosSave: [{
      objectName: 'OrderPos',
      mapAll: 'true',
      name,
      price,
      priceNet: price,
      quantity,
      unity: { id: '9', objectName: 'Unity' },
      taxRate: 19,
      positionNumber,
      text: text || '',
      discount: 0,
    }],
    orderPosDelete: null,
  });
  return data?.objects;
}

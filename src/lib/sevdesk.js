// Thin client for the sevDesk API, routed through our server proxy at
// /api/sevdesk/request to avoid browser CORS restrictions.

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

export async function createOffer(token, {
  contactId,
  header,
  headText,
  footText,
  offerNumber,
  offerDate,
  deliveryDate,
  timeToPay,
}) {
  const userId = await getSevUserId(token).catch(() => null);
  const body = {
    objectName: 'Offer',
    mapAll: 'true',
    offerNumber,
    contact: { id: contactId, objectName: 'Contact' },
    offerDate: offerDate || new Date().toISOString().slice(0, 10),
    header,
    headText,
    footText,
    timeToPay: timeToPay || 14,
    deliveryDate: deliveryDate || new Date().toISOString().slice(0, 10),
    status: '100',
    smallSettlement: 0,
    taxRate: 19,
    taxText: 'Umsatzsteuer 19%',
    taxType: 'default',
    currency: 'EUR',
    showNet: 1,
    sendType: 'VPR',
    address: '',
  };
  if (userId) {
    body.contactPerson = { id: userId, objectName: 'SevUser' };
  }
  const data = await sevRequest(token, 'POST', '/Offer', body);
  return data?.objects?.offer || data?.objects || data;
}

export async function createOfferPos(token, {
  offerId,
  name,
  text,
  quantity = 1,
  price = 0,
  positionNumber = 1,
}) {
  const data = await sevRequest(token, 'POST', '/OfferPos', {
    objectName: 'OfferPos',
    mapAll: 'true',
    offer: { id: offerId, objectName: 'Offer' },
    name,
    price,
    quantity,
    unity: { id: '1', objectName: 'Unity' },
    taxRate: 19,
    text,
    positionNumber,
  });
  return data?.objects;
}

// Thin client for the sevDesk API, routed through our server proxy at
// /api/sevdesk/request to avoid browser CORS restrictions.

async function sevRequest(token, method, path, body) {
  const res = await fetch('/api/sevdesk/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, method, path, body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error || data?.message || `sevDesk Fehler (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export async function searchContacts(token, query) {
  if (!query || !query.trim()) return [];
  const data = await sevRequest(token, 'GET', `/Contact?depth=1&limit=50`);
  const list = data?.objects || [];
  const q = query.trim().toLowerCase();
  return list.filter((c) => {
    const name = c.name || `${c.surename || ''} ${c.familyname || ''}`.trim();
    return name.toLowerCase().includes(q);
  });
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

export async function createOffer(token, { contactId, header, headText, footText, offerNumber }) {
  const data = await sevRequest(token, 'POST', '/Offer', {
    offer: {
      objectName: 'Offer',
      status: 100,
      contact: { id: contactId, objectName: 'Contact' },
      offerNumber,
      header,
      headText,
      footText,
      taxRate: 19,
      taxType: 'default',
      currency: 'EUR',
    },
    offerPosSave: [],
    offerPosDelete: null,
  });
  return data?.objects?.offer || data?.objects;
}

export async function createOfferPos(token, {
  offerId,
  name,
  text,
  quantity = 1,
  price = 0,
  isTitle = false,
  positionNumber = 0,
}) {
  const data = await sevRequest(token, 'POST', '/OfferPos', {
    offer: { id: offerId, objectName: 'Offer' },
    positionNumber,
    quantity,
    price,
    priceGross: price,
    priceTax: 0,
    name,
    text,
    unity: { id: 1, objectName: 'Unity' },
    taxRate: 19,
    isTitle,
  });
  return data?.objects;
}

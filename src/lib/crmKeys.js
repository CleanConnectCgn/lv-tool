// Reine Funktionen zur Kunden-Identifikation im CRM, extrahiert aus
// server/index.js damit sie unabhängig vom Express-Server testbar sind.
// Wird sowohl vom Server (via relativen Import) als auch von Tests genutzt.

export function slugifyCustomerName(name) {
  return (
    (name || 'unbekannt')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'unbekannt'
  );
}

// Ein Kunde wird über die sevDesk-Kontakt-ID identifiziert, wenn vorhanden,
// sonst über einen aus dem Namen abgeleiteten Slug - so werden Kunden über
// mehrere Dokumente hinweg konsistent zusammengeführt, auch ohne sevDesk-ID.
export function customerKeyFor(customer) {
  if (!customer) return null;
  if (customer.id) return `sevdesk-${customer.id}`;
  if (customer.name) return `name-${slugifyCustomerName(customer.name)}`;
  return null;
}

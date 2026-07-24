import { describe, it, expect } from 'vitest';
import { slugifyCustomerName, customerKeyFor } from './crmKeys.js';

describe('slugifyCustomerName', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugifyCustomerName('Test Kunde GmbH')).toBe('test-kunde-gmbh');
  });

  it('strips German umlauts/diacritics to their base letters', () => {
    expect(slugifyCustomerName('Kölner Physio Kollektiv')).toBe('kolner-physio-kollektiv');
  });

  it('handles ampersands and special characters', () => {
    expect(slugifyCustomerName('Simone Adam &Birgit Ziemer Gbr')).toBe('simone-adam-birgit-ziemer-gbr');
  });

  it('falls back to "unbekannt" for empty/missing names', () => {
    expect(slugifyCustomerName('')).toBe('unbekannt');
    expect(slugifyCustomerName(undefined)).toBe('unbekannt');
  });

  it('produces the same slug for the same name every time (stable)', () => {
    expect(slugifyCustomerName('ohja events')).toBe(slugifyCustomerName('ohja events'));
  });
});

describe('customerKeyFor', () => {
  it('prefers the sevDesk contact id when present', () => {
    expect(customerKeyFor({ id: '123', name: 'Egal GmbH' })).toBe('sevdesk-123');
  });

  it('falls back to a name-based slug when no id is present', () => {
    expect(customerKeyFor({ name: 'Test Kunde' })).toBe('name-test-kunde');
  });

  it('returns null when there is no customer at all', () => {
    expect(customerKeyFor(null)).toBeNull();
    expect(customerKeyFor(undefined)).toBeNull();
  });

  it('returns null when the customer has neither id nor name', () => {
    expect(customerKeyFor({ street: 'Teststr 1' })).toBeNull();
  });

  it('produces the same key for the same customer across multiple documents', () => {
    const doc1Customer = { id: '999', name: 'Firma A' };
    const doc2Customer = { id: '999', name: 'Firma A GmbH' }; // Name leicht geändert, ID gleich
    expect(customerKeyFor(doc1Customer)).toBe(customerKeyFor(doc2Customer));
  });

  it('two customers with the same name but no id collide into the same key (documented limitation)', () => {
    const a = customerKeyFor({ name: 'Max Mustermann' });
    const b = customerKeyFor({ name: 'Max Mustermann' });
    expect(a).toBe(b);
  });
});

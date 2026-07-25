import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { categorizeMatches, fetchSevDeskContactsWithEmail, registerSevdeskLinkRoutes } from './sevdeskLink.js';
import { prisma } from './prisma.js';

describe('categorizeMatches (reine Logik, kein I/O)', () => {
  it('verknüpft bei exakter E-Mail-Übereinstimmung automatisch', () => {
    const customers = [{ id: 'c1', name: 'Muster GmbH', email: 'info@muster.de' }];
    const sevContacts = [{ id: 's1', name: 'Muster GmbH', email: 'info@muster.de' }];
    const { autoLinked, suggestions } = categorizeMatches(customers, sevContacts);
    expect(autoLinked).toEqual([
      { customerId: 'c1', customerName: 'Muster GmbH', sevdeskContactId: 's1', contactName: 'Muster GmbH', reason: 'email_exact' },
    ]);
    expect(suggestions).toEqual([]);
  });

  it('macht bei gleicher Domain, anderer E-Mail nur einen Vorschlag', () => {
    const customers = [{ id: 'c1', name: 'Muster GmbH', email: 'buchhaltung@muster.de' }];
    const sevContacts = [{ id: 's1', name: 'Muster GmbH', email: 'info@muster.de' }];
    const { autoLinked, suggestions } = categorizeMatches(customers, sevContacts);
    expect(autoLinked).toEqual([]);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].reason).toBe('same_domain');
  });

  it('verknüpft bei nur ähnlichem Firmennamen NIEMALS automatisch - nur Vorschlag', () => {
    const customers = [{ id: 'c1', name: 'Musterfirma GmbH', email: null }];
    const sevContacts = [{ id: 's1', name: 'Musterfirma UG', email: null }];
    const { autoLinked, suggestions } = categorizeMatches(customers, sevContacts);
    expect(autoLinked).toEqual([]);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].reason).toBe('similar_name');
  });

  it('macht keinen Vorschlag bei völlig unterschiedlichen Namen ohne E-Mail-Signal', () => {
    const customers = [{ id: 'c1', name: 'Ganz andere Firma', email: null }];
    const sevContacts = [{ id: 's1', name: 'Voellig verschiedener Name AG', email: null }];
    const { autoLinked, suggestions } = categorizeMatches(customers, sevContacts);
    expect(autoLinked).toEqual([]);
    expect(suggestions).toEqual([]);
  });

  it('vergibt einen bereits verknüpften sevDesk-Kontakt nicht ein zweites Mal', () => {
    const customers = [
      { id: 'c1', name: 'Muster GmbH', email: 'info@muster.de' },
      { id: 'c2', name: 'Muster GmbH Zweigstelle', email: 'info@muster.de' },
    ];
    const sevContacts = [{ id: 's1', name: 'Muster GmbH', email: 'info@muster.de' }];
    const { autoLinked } = categorizeMatches(customers, sevContacts);
    expect(autoLinked).toHaveLength(1);
  });

  it('ignoriert Groß-/Kleinschreibung bei E-Mail-Vergleich', () => {
    const customers = [{ id: 'c1', name: 'Muster GmbH', email: 'Info@Muster.de' }];
    const sevContacts = [{ id: 's1', name: 'Muster GmbH', email: 'info@muster.de' }];
    const { autoLinked } = categorizeMatches(customers, sevContacts);
    expect(autoLinked).toHaveLength(1);
  });
});

describe('fetchSevDeskContactsWithEmail (live gegen die echte, nur lesende sevDesk-API)', () => {
  it('liefert Kontakte mit E-Mail, wo vorhanden', async () => {
    if (!process.env.SEVDESK_TOKEN) {
      console.warn('SEVDESK_TOKEN nicht gesetzt - überspringe Live-Test');
      return;
    }
    const contacts = await fetchSevDeskContactsWithEmail(process.env.SEVDESK_TOKEN);
    expect(Array.isArray(contacts)).toBe(true);
    expect(contacts.length).toBeGreaterThan(0);
    expect(contacts[0]).toHaveProperty('id');
    expect(contacts[0]).toHaveProperty('name');
  }, 20000);
});

describe('POST /api/db/sevdesk-link/confirm, DELETE /api/db/sevdesk-link/:customerId', () => {
  let app;
  let customerId;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    registerSevdeskLinkRoutes(app);
    const customer = await prisma.customer.create({ data: { name: 'Verknüpfungstest GmbH (Block 6)' } });
    customerId = customer.id;
  });

  afterAll(async () => {
    await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('verknüpft manuell, verweigert eine zweite Verknüpfung desselben sevDesk-Kontakts, löst wieder', async () => {
    const other = await prisma.customer.create({ data: { name: 'Zweiter Testkunde (Block 6)' } });
    try {
      const confirmRes = await request(app)
        .post('/api/db/sevdesk-link/confirm')
        .send({ customerId, sevdeskContactId: 'fake-sevdesk-id-123' })
        .expect(200);
      expect(confirmRes.body.sevdeskContactId).toBe('fake-sevdesk-id-123');

      // Derselbe sevDesk-Kontakt darf nicht an einen zweiten Kunden vergeben werden.
      await request(app)
        .post('/api/db/sevdesk-link/confirm')
        .send({ customerId: other.id, sevdeskContactId: 'fake-sevdesk-id-123' })
        .expect(409);

      // "Jede Verknüpfung muss sich wieder lösen lassen."
      const unlinkRes = await request(app).delete(`/api/db/sevdesk-link/${customerId}`).expect(200);
      expect(unlinkRes.body.sevdeskContactId).toBeNull();

      // Nach dem Lösen ist der sevDesk-Kontakt wieder frei vergebbar.
      await request(app)
        .post('/api/db/sevdesk-link/confirm')
        .send({ customerId: other.id, sevdeskContactId: 'fake-sevdesk-id-123' })
        .expect(200);
    } finally {
      await prisma.customer.delete({ where: { id: other.id } }).catch(() => {});
    }
  });
});

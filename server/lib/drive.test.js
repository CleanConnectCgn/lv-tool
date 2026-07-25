import { describe, it, expect } from 'vitest';
import { uploadDocumentToDrive } from './drive.js';

describe('uploadDocumentToDrive', () => {
  it('greift nicht durch und wirft nicht, wenn keine OAuth-Verbindung besteht', async () => {
    const result = await uploadDocumentToDrive({
      oauthClient: null,
      crmDir: '/tmp/irrelevant',
      filename: 'test.json',
      jsonContent: '{}',
    });
    expect(result).toEqual({ uploaded: false, reason: 'not_connected' });
  });

  it('fängt Fehler des Drive-Clients ab statt zu werfen (z.B. fehlender Scope)', async () => {
    const failingClient = {
      request: () => {
        throw new Error('insufficient authentication scopes');
      },
    };
    const result = await uploadDocumentToDrive({
      oauthClient: failingClient,
      crmDir: '/tmp/irrelevant-drive-test',
      filename: 'test.json',
      jsonContent: '{}',
    });
    expect(result.uploaded).toBe(false);
    expect(result.reason).toBeTruthy();
  });
});

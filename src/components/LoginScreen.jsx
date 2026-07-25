import React from 'react';
import { LOGO_URI } from '../assets/logo.js';
import { GOOGLE_LOGIN_URL } from '../lib/auth.js';

// "Abgelehnte Anmeldung zeigt eine klare Meldung, keinen Fehlercode" - der
// Callback leitet bei nicht erlaubter E-Mail auf /?auth=denied um, hier wird
// das in einen verständlichen deutschen Satz übersetzt statt eines rohen
// Statuscodes.
export default function LoginScreen({ denied }) {
  return (
    <div className="overview-page">
      <div className="overview-page-card" style={{ textAlign: 'center' }}>
        <img src={LOGO_URI} alt="Clean Connect" style={{ height: 56, marginBottom: 16 }} />
        <h2>Anmeldung erforderlich</h2>
        <p className="modal-hint" style={{ marginBottom: 24 }}>
          Dieses Tool ist nur für freigeschaltete Clean Connect Google-Konten zugänglich.
        </p>

        {denied && (
          <div className="modal-message error" style={{ marginBottom: 20 }}>
            Dieses Google-Konto hat keinen Zugang zu diesem Tool. Bitte an einen Administrator wenden, falls das
            nicht stimmt.
          </div>
        )}

        <a href={GOOGLE_LOGIN_URL}>
          <button type="button" className="primary">
            Mit Google anmelden
          </button>
        </a>
      </div>
    </div>
  );
}

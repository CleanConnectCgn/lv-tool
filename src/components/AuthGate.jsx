import React, { useEffect, useState } from 'react';
import LoginScreen from './LoginScreen.jsx';
import { getCurrentUser } from '../lib/auth.js';

export default function AuthGate({ children }) {
  const [status, setStatus] = useState('loading'); // loading | anonymous | authenticated
  const [error, setError] = useState('');

  useEffect(() => {
    getCurrentUser()
      .then((user) => setStatus(user ? 'authenticated' : 'anonymous'))
      .catch((err) => {
        setError(err?.message || 'Anmeldestatus konnte nicht geprüft werden');
        setStatus('anonymous');
      });
  }, []);

  if (status === 'loading') return null;

  if (status === 'anonymous') {
    const denied = new URLSearchParams(window.location.search).get('auth') === 'denied';
    return (
      <>
        <LoginScreen denied={denied} />
        {error && (
          <div className="overview-page" style={{ paddingTop: 0 }}>
            <div className="modal-message error">{error}</div>
          </div>
        )}
      </>
    );
  }

  return children;
}

import React, { useEffect, useRef, useState } from 'react';

// Nimmt über das Mikrofon auf, schickt die Aufnahme an /api/lv/diktat und
// gibt das Transkript per onTranskript zurück. Das Ergebnis landet immer in
// einem Feld zum Nachbearbeiten - es wird nie direkt weiterverarbeitet.
export default function DiktatButton({
  onTranskript,
  onFehler,
  disabled = false,
  labelIdle = '🎤 Sprechen',
  labelRecording = '■ Aufnahme beenden',
  labelBusy = 'Hört ab…',
}) {
  const [status, setStatus] = useState('idle'); // idle | hoert | transkribiert
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(
    () => () => {
      // Beim Verlassen der Ansicht das Mikrofon sicher freigeben.
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      recorderRef.current?.stream?.getTracks?.().forEach((t) => t.stop());
    },
    []
  );

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size === 0) {
          setStatus('idle');
          return;
        }
        setStatus('transkribiert');
        try {
          const mimeType = (recorder.mimeType || 'audio/webm').split(';')[0];
          const res = await fetch(`/api/lv/diktat?mimeType=${encodeURIComponent(mimeType)}`, {
            method: 'POST',
            headers: { 'Content-Type': mimeType },
            body: blob,
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || data?.error) throw new Error(data?.error || 'Unbekannter Fehler');
          const text = (data.transkript || '').trim();
          if (!text) {
            onFehler?.('Es war nichts Verständliches zu hören.');
          } else {
            onTranskript?.(text);
          }
        } catch (err) {
          onFehler?.(err?.message || 'Unbekannter Fehler');
        } finally {
          setStatus('idle');
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setStatus('hoert');
    } catch {
      onFehler?.('Kein Zugriff auf das Mikrofon. Bitte im Browser erlauben.');
      setStatus('idle');
    }
  }

  function stop() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }

  const label = status === 'hoert' ? labelRecording : status === 'transkribiert' ? labelBusy : labelIdle;

  return (
    <button
      type="button"
      className={`lv-assistant-mic${status === 'hoert' ? ' recording' : ''}`}
      onClick={status === 'hoert' ? stop : start}
      disabled={disabled || status === 'transkribiert'}
      title={status === 'hoert' ? 'Aufnahme beenden' : 'Sprachaufnahme starten'}
    >
      {label}
    </button>
  );
}

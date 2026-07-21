import React from 'react';

export default function AIStatusBadge({ status, issues, onClick }) {
  if (status === 'idle') return null;

  let label = '';
  let className = 'ai-status-badge';
  if (status === 'pending') {
    label = 'KI analysiert...';
    className += ' pending';
  } else if (status === 'error') {
    label = 'KI Check fehlgeschlagen';
    className += ' error';
  } else if (status === 'done') {
    const redCount = issues.filter((i) => i.type === 'red').length;
    const orangeCount = issues.filter((i) => i.type === 'orange').length;
    if (redCount + orangeCount === 0) {
      label = 'LV geprüft ✓';
      className += ' clean';
    } else if (redCount > 0) {
      label = `${redCount + orangeCount} Probleme gefunden 🔴`;
      className += ' issues-red';
    } else {
      label = `${orangeCount} Hinweise 🟠`;
      className += ' issues-orange';
    }
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {status === 'pending' && <span className="ai-status-spinner" />}
      {label}
    </button>
  );
}

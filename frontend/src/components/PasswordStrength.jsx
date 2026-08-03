import React from 'react';

export default function PasswordStrength({ password }) {
  const score = [
    password.length >= 6,
    password.length >= 10,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const pct = (score / 5) * 100;
  let label = 'Very weak';
  let color = 'var(--error)';
  if (score >= 4) { label = 'Strong'; color = 'var(--success)'; }
  else if (score >= 3) { label = 'Good'; color = 'var(--warning)'; }
  else if (score >= 2) { label = 'Fair'; color = 'var(--warning)'; }

  if (!password) return null;

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'all 0.3s ease' }} />
      </div>
      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}

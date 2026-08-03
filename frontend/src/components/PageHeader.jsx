import React from 'react';

export default function PageHeader({ title, description, action, actionLabel, actionIcon: ActionIcon, right }) {
  return (
    <div style={{
      background: 'var(--brand)',
      borderRadius: 'var(--radius-lg)',
      padding: '1.5rem 2rem',
      marginBottom: '1.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      color: 'var(--text-inverse)',
    }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</h1>
        {description && (
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.875rem', opacity: 0.85 }}>{description}</p>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
        {right}
        {action && (
          <button
            onClick={action}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.25rem',
              background: 'var(--text-inverse)',
              color: 'var(--brand)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {ActionIcon && <ActionIcon weight="bold" size={16} />}
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

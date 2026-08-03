import React from 'react';

export default function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="skip-to-content"
      style={{
        position: 'absolute',
        top: '-40px',
        left: 0,
        background: 'var(--brand)',
        color: 'var(--text-inverse)',
        padding: '8px 16px',
        zIndex: 10000,
        textDecoration: 'none',
        fontWeight: 600,
        fontSize: '0.875rem',
        borderRadius: '0 0 8px 0',
        transition: 'top 0.2s',
      }}
      onFocus={(e) => (e.target.style.top = '0')}
      onBlur={(e) => (e.target.style.top = '-40px')}
    >
      Skip to main content
    </a>
  );
}

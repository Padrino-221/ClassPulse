import React from 'react';
import { useNavigate } from 'react-router-dom';
import { House } from '@phosphor-icons/react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-global)',
      padding: '2rem',
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: 480,
      }}>
        <h1 style={{
          fontSize: '7rem',
          fontWeight: 800,
          color: 'var(--brand)',
          lineHeight: 1,
          marginBottom: '0.5rem',
          letterSpacing: '-2px',
        }}>404</h1>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '0.75rem',
        }}>Page not found</h2>
        <p style={{
          fontSize: '0.9375rem',
          color: 'var(--text-secondary)',
          marginBottom: '2rem',
          lineHeight: 1.6,
        }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            height: 42,
            padding: '0 1.5rem',
            background: 'var(--brand)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: '0.9375rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--brand-dark)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(var(--brand-rgb), 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--brand)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <House size={20} weight="bold" />
          Go Home
        </button>
      </div>
    </div>
  );
}

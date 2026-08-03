import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-global)',
        padding: '2rem',
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          maxWidth: 420,
          width: '100%',
          padding: '2.5rem',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: '4rem',
            fontWeight: 800,
            color: 'var(--brand)',
            lineHeight: 1,
            margin: 0,
          }}
        >
          404
        </h1>
        <h2
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: '0.75rem 0',
          }}
        >
          Page Not Found
        </h2>
        <p
          style={{
            fontSize: '0.9375rem',
            color: 'var(--text-secondary)',
            marginBottom: '2rem',
            lineHeight: 1.6,
          }}
        >
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          style={{
            display: 'inline-block',
            background: 'var(--brand)',
            color: 'var(--text-inverse)',
            border: 'none',
            borderRadius: 6,
            padding: '0.75rem 1.5rem',
            fontSize: '0.9375rem',
            fontWeight: 600,
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}

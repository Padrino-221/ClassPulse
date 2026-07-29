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
        background: '#F5F5F5',
        padding: '2rem',
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: 8,
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
            color: '#DC2626',
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
            color: '#1A1A1A',
            margin: '0.75rem 0',
          }}
        >
          Page Not Found
        </h2>
        <p
          style={{
            fontSize: '0.9375rem',
            color: '#6B7280',
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
            background: '#DC2626',
            color: '#FFFFFF',
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

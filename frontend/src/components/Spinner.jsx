import React from 'react';

export default function Spinner({ size = 16 }) {
  return (
    <span className="btn-spinner" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="31.4 31.4" />
      </svg>
    </span>
  );
}

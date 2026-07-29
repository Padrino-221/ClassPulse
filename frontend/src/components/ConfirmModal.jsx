import React, { useState } from 'react';
import { Warning } from '@phosphor-icons/react';

export default function ConfirmModal({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, onConfirm, onCancel }) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onCancel();
    } catch {
      onCancel();
    } finally {
      setLoading(false);
    }
  };

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '1rem',
      }}
    >
      <div style={{
        background: 'var(--bg-card, #fff)', borderRadius: '8px',
        border: '1px solid var(--border-light, #e5e7eb)',
        padding: '1.5rem', width: '100%', maxWidth: '400px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', marginBottom: '1rem' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '8px',
            background: danger ? 'var(--brand-light, #FEF2F2)' : 'var(--warning-bg, #FEF9C3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Warning weight="duotone" size={20} color={danger ? 'var(--brand, #DC2626)' : 'var(--warning, #F59E0B)'} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary, #1A1A1A)' }}>{title}</h3>
            <p style={{ margin: '0.375rem 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary, #6B7280)', lineHeight: 1.5 }}>{message}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 600,
              color: 'var(--text-secondary, #6b7280)', backgroundColor: 'var(--bg-hover, #F5F5F5)',
              border: 'none', borderRadius: '6px', cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            style={{
              padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 600,
              color: 'var(--text-inverse, #fff)', backgroundColor: danger ? 'var(--brand, #DC2626)' : 'var(--warning, #F59E0B)',
              border: 'none', borderRadius: '6px', cursor: 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

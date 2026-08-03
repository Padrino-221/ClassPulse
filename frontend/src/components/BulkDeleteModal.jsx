import React, { useState } from 'react';
import { Warning } from '@phosphor-icons/react';

export default function BulkDeleteModal({ title, message, confirmLabel = 'Delete All', onConfirm, onCancel }) {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const confirmed = confirmText === 'DELETE ALL';

  const handleConfirm = async () => {
    if (!confirmed) return;
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
    if (e.target === e.currentTarget && !loading) onCancel();
  };

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '1rem',
      }}
      role="presentation"
    >
      <div style={{
        background: 'var(--bg-card, #fff)', borderRadius: '8px',
        border: '1px solid var(--border-light, #e5e7eb)',
        padding: '1.5rem', width: '100%', maxWidth: '400px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', marginBottom: '1rem' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '8px',
            background: 'var(--brand-light, #FEF2F2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Warning weight="duotone" size={20} color="var(--brand, #DC2626)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary, #1A1A1A)' }}>{title}</h3>
            <p style={{ margin: '0.375rem 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary, #6B7280)', lineHeight: 1.5 }}>{message}</p>
          </div>
        </div>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder='Type "DELETE ALL" to confirm'
          style={{
            width: '100%', padding: '0.625rem 0.875rem', fontSize: '0.875rem',
            border: '1px solid var(--error, #DC2626)', borderRadius: 'var(--radius-md, 6px)',
            outline: 'none', backgroundColor: 'var(--bg-input, #fff)', height: '42px', boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 600,
              color: 'var(--text-secondary, #6b7280)', backgroundColor: 'var(--bg-hover, #F5F5F5)',
              border: 'none', borderRadius: '6px', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!confirmed || loading}
            style={{
              padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 600,
              color: 'var(--text-inverse, #fff)', backgroundColor: 'var(--brand, #DC2626)',
              border: 'none', borderRadius: '6px', cursor: 'pointer',
              opacity: (!confirmed || loading) ? 0.5 : 1,
            }}
          >
            {loading ? 'Deleting...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

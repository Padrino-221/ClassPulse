import React, { useState } from 'react';
import { X, Eye, EyeSlash } from '@phosphor-icons/react';
import MultiSelect from './MultiSelect';
import Select from './Select';

export default function CreateModal({ entityLabel, fields, onSave, onClose }) {
  const [form, setForm] = useState(() => {
    const initial = {};
    fields.forEach(f => { initial[f.name] = f.type === 'multiselect' ? [] : ''; });
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPasswords, setShowPasswords] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || "Couldn't create.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const inputStyle = {
    width: '100%', padding: '0.625rem 0.875rem',
    border: '1px solid var(--border, #E5E7EB)',
    borderRadius: '6px', fontSize: '0.8125rem',
    background: '#fff', color: '#1A1A1A',
    outline: 'none', boxSizing: 'border-box', height: '42px',
  };

  const labelStyle = {
    display: 'block', fontSize: '0.6875rem', fontWeight: 700,
    color: '#6b7280', marginBottom: '0.375rem',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  };

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '1rem',
      }}
    >
      <div style={{
        background: '#fff', borderRadius: '8px',
        border: '1px solid var(--border-light, #e5e7eb)',
        padding: '1.5rem', width: '100%', maxWidth: '480px',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1A1A1A' }}>
            New {entityLabel}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9CA3AF', padding: '4px', borderRadius: '6px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>
        {error && (
          <div style={{
            backgroundColor: '#FEF2F2', color: '#dc2626', padding: '0.75rem 1rem',
            borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem', border: '1px solid #FCA5A5',
          }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          {fields.map((f) => (
            <div key={f.name} style={{ marginBottom: '0.875rem' }}>
              {f.type === 'multiselect' ? (
                <MultiSelect
                  label={f.label}
                  options={f.options || []}
                  value={Array.isArray(form[f.name]) ? form[f.name] : []}
                  onChange={(vals) => setForm({ ...form, [f.name]: vals })}
                />
              ) : f.type === 'select' ? (
                <>
                  <label style={labelStyle}>{f.label}</label>
                  <Select
                    value={form[f.name]}
                    onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                  >
                    <option value="">{f.placeholder || 'Select...'}</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </>
              ) : f.type === 'date' ? (
                <>
                  <label style={labelStyle}>{f.label}</label>
                  <input
                    type="date"
                    value={form[f.name]}
                    onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                    required={!f.optional}
                    style={inputStyle}
                  />
                </>
              ) : (
                <>
                  <label style={labelStyle}>{f.label}</label>
                  {f.type === 'password' ? (
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPasswords[f.name] ? 'text' : 'password'}
                        placeholder={f.placeholder}
                        value={form[f.name]}
                        onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                        required={!f.optional}
                        style={{ ...inputStyle, paddingRight: '2.5rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords((p) => ({ ...p, [f.name]: !p[f.name] }))}
                        style={{
                          position: 'absolute', right: '0.625rem', top: '50%',
                          transform: 'translateY(-50%)', background: 'none', border: 'none',
                          cursor: 'pointer', color: '#9CA3AF', padding: '2px',
                          display: 'flex', alignItems: 'center',
                        }}
                      >
                        {showPasswords[f.name] ? <EyeSlash size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  ) : (
                    <input
                      type={f.type || 'text'}
                      placeholder={f.placeholder}
                      value={form[f.name]}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                      required={!f.optional}
                      min={f.min}
                      max={f.max}
                      style={inputStyle}
                    />
                  )}
                </>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                flex: 1, padding: '0.625rem 1.25rem',
                fontSize: '0.8125rem', fontWeight: 600,
                color: '#fff', backgroundColor: '#DC2626',
                border: 'none', borderRadius: '6px',
                cursor: 'pointer', opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Creating...' : `Create ${entityLabel}`}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.625rem 1.25rem',
                fontSize: '0.8125rem', fontWeight: 600,
                color: '#6b7280', backgroundColor: '#F5F5F5',
                border: 'none', borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

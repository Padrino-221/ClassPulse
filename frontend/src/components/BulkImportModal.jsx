import React, { useState, useRef, useCallback } from 'react';
import { FileCsv, DownloadSimple, X, CheckCircle, Warning } from '@phosphor-icons/react';
import AccessibleModal from './AccessibleModal';
import Spinner from './Spinner';
import { getStoredToken } from '../utils/api';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function BulkImportModal({
  title,
  description,
  templateCsv,
  templateFileName = 'template.csv',
  endpoint,
  extraFields = {},
  columns = [],
  acceptedTypes = '.csv',
  maxFileSizeMB = 2,
  onImported,
  onCancel,
}) {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = useCallback((f) => {
    if (!f) return;
    if (f.size > maxFileSizeMB * 1024 * 1024) {
      setResult({ error: `File too large. Max ${maxFileSizeMB} MB.` });
      return;
    }
    setResult(null);
    setFile(f);
  }, [maxFileSizeMB]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    handleFile(f);
  }, [handleFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleInputChange = useCallback((e) => {
    handleFile(e.target.files?.[0]);
    e.target.value = '';
  }, [handleFile]);

  const handleImport = useCallback(async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      Object.entries(extraFields).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') formData.append(k, v);
      });
      const token = getStoredToken();
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}${endpoint}`, { method: 'POST', headers, body: formData });
      let data;
      try {
        data = await res.clone().json();
      } catch {
        const text = await res.text();
        throw new Error(text || `Request failed (${res.status}).`);
      }
      if (!res.ok) throw new Error(data.error || 'Import failed.');
      setResult(data);
      onImported?.(data);
    } catch (err) {
      setResult({ error: err.message || 'Import failed.' });
    } finally {
      setImporting(false);
    }
  }, [file, extraFields, endpoint, onImported]);

  const handleDownloadTemplate = useCallback(() => {
    const blob = new Blob(['\ufeff' + templateCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = templateFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [templateCsv, templateFileName]);

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const hasResult = !!result;
  const isSuccess = hasResult && !result.error;

  return (
    <AccessibleModal onClose={onCancel} title={title} maxWidth={480}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
        <button
          onClick={onCancel}
          aria-label="Close"
          style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
            padding: '4px', display: 'flex', borderRadius: 'var(--radius-sm)',
          }}
        >
          <X size={18} />
        </button>
      </div>
      {description && (
        <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {description}
        </p>
      )}

      {/* Drop zone */}
      {!hasResult && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !importing && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
          style={{
            border: `2px dashed ${dragOver ? 'var(--brand)' : file ? 'var(--success)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-lg)',
            padding: '2rem 1.5rem',
            textAlign: 'center',
            cursor: importing ? 'not-allowed' : 'pointer',
            background: dragOver ? 'rgba(var(--brand-rgb), 0.04)' : file ? 'var(--success-bg)' : 'var(--bg-input)',
            transition: 'all 0.2s ease',
            opacity: importing ? 0.6 : 1,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedTypes}
            onChange={handleInputChange}
            style={{ display: 'none' }}
            aria-hidden="true"
          />
          {file ? (
            <>
              <CheckCircle weight="duotone" size={32} color="var(--success)" />
              <p style={{ margin: '0.5rem 0 0.25rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {file.name}
              </p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {formatSize(file.size)} — <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); }}
                  style={{ background: 'none', border: 'none', color: 'var(--brand)', fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem', padding: 0, fontFamily: 'inherit' }}
                >Choose a different file</button>
              </p>
            </>
          ) : (
            <>
              <FileCsv weight="duotone" size={32} color={dragOver ? 'var(--brand)' : 'var(--text-muted)'} />
              <p style={{ margin: '0.5rem 0 0.25rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {dragOver ? 'Drop your file here' : 'Drag & drop your CSV file here'}
              </p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                or <span style={{ color: 'var(--brand)', fontWeight: 600 }}>browse</span> to choose a file
              </p>
            </>
          )}
        </div>
      )}

      {/* Result */}
      {hasResult && (
        <div style={{
          padding: '1rem',
          borderRadius: 'var(--radius-lg)',
          background: result.error ? 'var(--error-bg)' : 'var(--success-bg)',
          border: `1px solid ${result.error ? 'rgba(220,38,38,0.15)' : 'rgba(22,163,74,0.15)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
            {result.error ? (
              <Warning weight="duotone" size={18} color="var(--error)" style={{ marginTop: '2px', flexShrink: 0 }} />
            ) : (
              <CheckCircle weight="duotone" size={18} color="var(--success)" style={{ marginTop: '2px', flexShrink: 0 }} />
            )}
            <div>
              {result.error ? (
                <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--error)' }}>{result.error}</p>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--success)' }}>
                    {result.added} row{result.added !== 1 ? 's' : ''} added successfully
                  </p>
                  {result.skipped?.length > 0 && (
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {result.skipped.length} skipped (already exists)
                    </p>
                  )}
                  {result.errors?.length > 0 && (
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--error)' }}>
                      {result.errors.length} row{result.errors.length !== 1 ? 's' : ''} with errors
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Template info */}
      <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-global)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Expected columns
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.625rem' }}>
          {columns.map((col) => (
            <span key={col} style={{
              padding: '0.2rem 0.5rem', fontSize: '0.75rem', fontWeight: 600,
              background: 'var(--bg-card)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              fontFamily: 'monospace',
            }}>
              {col}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={handleDownloadTemplate}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.375rem 0.75rem', fontSize: '0.75rem', fontWeight: 600,
            background: 'var(--bg-card)', color: 'var(--brand)',
            border: '1px solid var(--error-border, #FCA5A5)', borderRadius: 'var(--radius-sm)',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
          }}
        >
          <DownloadSimple size={13} /> Download template
        </button>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
        <button
          onClick={onCancel}
          disabled={importing}
          style={{
            padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 600,
            color: 'var(--text-secondary)', background: 'var(--bg-hover)',
            border: 'none', borderRadius: '6px', cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {hasResult ? 'Close' : 'Cancel'}
        </button>
        {!hasResult && (
          <button
            onClick={handleImport}
            disabled={!file || importing}
            style={{
              padding: '0.5rem 1.25rem', fontSize: '0.8125rem', fontWeight: 600,
              color: 'var(--text-inverse)', background: 'var(--brand)',
              border: 'none', borderRadius: '6px', cursor: (!file || importing) ? 'not-allowed' : 'pointer',
              opacity: (!file || importing) ? 0.5 : 1,
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              fontFamily: 'inherit', transition: 'all 0.15s',
            }}
          >
            {importing && <Spinner size={14} />}
            {importing ? 'Importing...' : 'Import'}
          </button>
        )}
      </div>
    </AccessibleModal>
  );
}

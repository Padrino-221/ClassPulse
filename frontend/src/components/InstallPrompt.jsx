import React, { useEffect, useState } from 'react';
import { DownloadSimple, X } from '@phosphor-icons/react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!visible || installed) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setVisible(false);
      setDeferredPrompt(null);
    }
  };

  return (
    <div style={{
      position: 'fixed', left: '0.75rem', right: '0.75rem', bottom: '0.75rem',
      background: 'var(--bg-card, #fff)', border: '1px solid var(--border, #E5E7EB)',
      borderRadius: '10px', padding: '0.875rem 1rem', zIndex: 900,
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      display: 'flex', alignItems: 'center', gap: '0.75rem',
    }}>
      <div style={{
        width: '36px', height: '36px', borderRadius: '8px',
        background: 'var(--brand, #DC2626)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0,
      }}>
        <DownloadSimple weight="duotone" size={18} color="#fff" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary, #1A1A1A)' }}>
          Install ClassPulse
        </div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary, #6B7280)', marginTop: '0.125rem' }}>
          Open it like an app and mark attendance faster.
        </div>
      </div>
      <button
        type="button"
        onClick={handleInstall}
        style={{
          padding: '0.45rem 0.875rem', fontSize: '0.75rem', fontWeight: 700,
          color: '#fff', backgroundColor: 'var(--brand, #DC2626)', border: 'none',
          borderRadius: '6px', cursor: 'pointer', flexShrink: 0,
        }}
      >
        Install
      </button>
      <button
        type="button"
        aria-label="Dismiss install prompt"
        onClick={() => { setVisible(false); }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted, #9ca3af)', padding: '4px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

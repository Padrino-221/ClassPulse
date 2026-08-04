let cachedFingerprint = null;

export async function generateFingerprint() {
  if (cachedFingerprint) return cachedFingerprint;

  const getCanvasFingerprint = () => {
    try {
      const canvas = document.createElement('canvas');
      // Keep the canvas small (96px) and hint at frequent reads to minimise the
      // synchronous canvas/draw/toDataURL cost that blocks the main thread.
      canvas.width = 96;
      canvas.height = 96;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f60';
      ctx.fillRect(38, 38, 20, 20);
      ctx.fillStyle = '#069';
      ctx.font = '10px Arial';
      ctx.fillText('ClassPulse', 8, 48);
      return canvas.toDataURL();
    } catch {
      return 'canvas:unsupported';
    }
  };

  const components = [
    navigator.userAgent,
    navigator.hardwareConcurrency || 'unknown',
    screen.width,
    screen.height,
    screen.colorDepth || 'unknown',
    navigator.language || 'unknown',
    navigator.platform || 'unknown',
    navigator.maxTouchPoints || 0,
    getCanvasFingerprint(),
    new Date().getTimezoneOffset(),
  ];

  const raw = components.join('|||');
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  cachedFingerprint = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return cachedFingerprint;
}

// Pre-warm the fingerprint during browser idle so the first check-in doesn't pay
// the synchronous canvas cost while the user is waiting to submit. Once computed
// it is memoized, so the later `await generateFingerprint()` in the check-in
// flow returns immediately without blocking the main thread.
if (typeof window !== 'undefined') {
  const scheduleIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 250));
  scheduleIdle(() => { generateFingerprint().catch(() => {}); });
}

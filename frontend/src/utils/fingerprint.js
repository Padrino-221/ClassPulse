let cachedFingerprint = null;

export async function generateFingerprint() {
  if (cachedFingerprint) return cachedFingerprint;

  const getCanvasFingerprint = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f60';
      ctx.fillRect(100, 100, 50, 50);
      ctx.fillStyle = '#069';
      ctx.font = '14px Arial';
      ctx.fillText('ClassPulse', 20, 130);
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

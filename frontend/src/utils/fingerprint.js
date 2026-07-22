export async function generateFingerprint() {
  const components = [
    navigator.userAgent,
    navigator.hardwareConcurrency || 'unknown',
    screen.width,
    screen.height,
    navigator.language || 'unknown',
  ];

  const raw = components.join('|||');
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

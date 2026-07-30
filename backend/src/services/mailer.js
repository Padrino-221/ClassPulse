const { Resend } = require('resend');
require('dotenv').config();

let resend = null;

function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured — emails disabled');
  }
  if (resend) return resend;
  resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const BRAND = '#DC2626';
const TEXT = '#1A1A1A';
const TEXT_SEC = '#6B7280';
const TEXT_MUTED = '#9CA3AF';
const BORDER = '#E5E7EB';
const BG = '#F5F5F5';
const CARD = '#FFFFFF';
const FONT = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function svgDataUri(svg) {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const ICONS = {
  shield: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="white" viewBox="0 0 256 256"><path d="M208,40H48A16,16,0,0,0,32,56V128c0,49.07,33.54,94.61,78.71,106.55a15.84,15.84,0,0,0,12.58,0C168.46,222.61,202,177.07,202,128V56A16,16,0,0,0,188,40Zm-61,82.75-40,40a8,8,0,0,1-11.32-11.32L116.69,128,88.4,99.6a8,8,0,0,1,11.32-11.32l40,40A8,8,0,0,1,147,122.75Z"/></svg>`,
  wave: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="white" viewBox="0 0 256 256"><path d="M156,128a8,8,0,0,0-8,8v23.55l-19.64-19.64a8,8,0,0,0-11.32,11.32L140.69,176H96a8,8,0,0,0,0,16h40a8,8,0,0,0,8-8V136A8,8,0,0,0,156,128ZM219.71,188.63l-72.54-41.73A4.73,4.73,0,0,0,144,151v17.37l-38.18-22a4,4,0,0,0-4.24.22L72,160.42V112a4,4,0,0,0-4-4,4,4,0,0,0-4,4V200a4,4,0,0,0,4,4h40a4,4,0,0,0,4-4V181.55l38.72,22.35a31.54,31.54,0,0,0,15.14,4.1c.14,0,.27,0,.41,0a32,32,0,0,0,30-21.34l5.57-43.95A4,4,0,0,0,198.11,130a4,4,0,0,0-2.87,1.64l-10.73,16.09V112a4,4,0,0,0-8,0v26.29l-6.13-9.2a4,4,0,0,0-6.62-.24l-22.36,33.54V128a4,4,0,0,0-8,0v39.29l-13.27-19.91a4,4,0,0,0-6.62-.24L92,172.91V128a4,4,0,0,0-8,0V200a4,4,0,0,0,4,4h40a4,4,0,0,0,4-4V181.55"/></svg>`,
  clock: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="#6B7280" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm8-128V128l24,24"/></svg>`,
  lock: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="#6B7280" viewBox="0 0 256 256"><path d="M208,104H181.31L164.69,87.38A52,52,0,0,0,72,80V56a8,8,0,0,0-8,8V200a8,8,0,0,0,8,8H208a8,8,0,0,0,8-8V112A8,8,0,0,0,208,104ZM128,168a16,16,0,1,1,16-16A16,16,0,0,1,128,168Z"/></svg>`,
};

function iconImg(name, size = 18) {
  return `<img src="${svgDataUri(ICONS[name])}" alt="" width="${size}" height="${size}" style="display:block;border:0;" />`;
}

function baseShell(title, headerIconKey, headerTitle, contentHtml) {
  const headerIcon = iconImg(headerIconKey, 28);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ClassPulse</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:${FONT};-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${BG};padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:460px;">
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center" style="background:${BRAND};width:38px;height:38px;border-radius:8px;font-size:16px;font-weight:800;color:#FFFFFF;line-height:38px;text-align:center;">C</td>
                  <td style="padding-left:10px;font-size:1.125rem;font-weight:700;color:${TEXT};line-height:38px;letter-spacing:-0.02em;">ClassPulse</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:${CARD};border-radius:8px;border:1px solid ${BORDER};overflow:hidden;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:${BRAND};padding:32px 40px 28px;text-align:center;">
                    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 14px;">
                      <tr>
                        <td align="center" style="background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.2);width:56px;height:56px;border-radius:50%;">
                          ${headerIcon}
                        </td>
                      </tr>
                    </table>
                    <h1 style="margin:0;font-size:1.25rem;font-weight:700;color:#FFFFFF;line-height:1.3;letter-spacing:-0.01em;">${headerTitle}</h1>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:36px 40px 32px;">
                    ${contentHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:28px;">
              <p style="margin:0 0 6px;font-size:0.8125rem;color:${TEXT_SEC};line-height:1.5;">ClassPulse &mdash; Attendance Management</p>
              <p style="margin:0;font-size:0.75rem;color:${TEXT_MUTED};line-height:1.5;">Automated message &middot; do not reply</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function resetTemplate(resetUrl, userName) {
  const greeting = userName ? `Hello ${userName},` : 'Hello,';
  const content = `
    <p style="margin:0 0 6px;font-size:0.875rem;font-weight:600;color:${TEXT};line-height:1.5;">${greeting}</p>
    <p style="margin:0 0 24px;font-size:0.875rem;color:${TEXT_SEC};line-height:1.7;">We received a request to reset your ClassPulse password. Click below to set a new one.</p>
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
      <tr>
        <td align="center" style="background:${BRAND};border-radius:6px;padding:14px 36px;">
          <a href="${resetUrl}" style="color:#FFFFFF;font-size:0.875rem;font-weight:600;text-decoration:none;display:inline-block;letter-spacing:0.01em;">Reset Password</a>
        </td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr><td style="border-top:1px solid ${BORDER};padding:0;"></td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:20px;">
      <tr>
        <td>
          <table cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="vertical-align:middle;padding-right:10px;">
                ${iconImg('clock')}
              </td>
              <td>
                <p style="margin:0;font-size:0.8125rem;color:${TEXT_SEC};line-height:1.6;">This link expires in <strong style="color:${TEXT};">1 hour</strong>.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:14px;">
      <tr>
        <td style="background:#FEF2F2;border:1px solid #FCA5A5;border-radius:8px;padding:16px 20px;">
          <table cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="vertical-align:middle;padding-right:10px;">
                ${iconImg('lock')}
              </td>
              <td>
                <p style="margin:0;font-size:0.8125rem;color:${TEXT_SEC};line-height:1.6;">If you didn't request this, ignore this email. Your password stays unchanged.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
  return baseShell('Reset Password', 'shield', 'Reset Your Password', content);
}

async function sendResetEmail(to, token, userType, userName = null) {
  const client = getResendClient();
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

  const { data, error } = await client.emails.send({
    from: process.env.FROM_EMAIL || 'ClassPulse <onboarding@resend.dev>',
    to,
    subject: 'ClassPulse — Reset Your Password',
    html: resetTemplate(resetUrl, userName),
  });

  if (error) {
    console.error('Email send error:', error);
    throw new Error(error.message || 'Failed to send email');
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('Reset email URL:', resetUrl);
  }

  return data;
}

function welcomeTemplate(userName, userEmail, resetUrl) {
  const content = `
    <p style="margin:0 0 6px;font-size:0.875rem;font-weight:600;color:${TEXT};line-height:1.5;">Hello ${userName},</p>
    <p style="margin:0 0 24px;font-size:0.875rem;color:${TEXT_SEC};line-height:1.7;">Your ClassPulse account is ready. Click below to set your password and get started.</p>
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
      <tr>
        <td align="center" style="background:${BRAND};border-radius:6px;padding:14px 36px;">
          <a href="${resetUrl}" style="color:#FFFFFF;font-size:0.875rem;font-weight:600;text-decoration:none;display:inline-block;letter-spacing:0.01em;">Set Your Password</a>
        </td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr><td style="border-top:1px solid ${BORDER};padding:0;"></td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:20px;">
      <tr>
        <td>
          <table cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="vertical-align:middle;padding-right:10px;">
                ${iconImg('clock')}
              </td>
              <td>
                <p style="margin:0;font-size:0.8125rem;color:${TEXT_SEC};line-height:1.6;">Link expires in <strong style="color:${TEXT};">1 hour</strong>. Email: <strong style="color:${TEXT};">${userEmail}</strong></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:14px;">
      <tr>
        <td style="background:#FEF2F2;border:1px solid #FCA5A5;border-radius:8px;padding:16px 20px;">
          <table cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="vertical-align:middle;padding-right:10px;">
                ${iconImg('lock')}
              </td>
              <td>
                <p style="margin:0;font-size:0.8125rem;color:${TEXT_SEC};line-height:1.6;">If you didn't expect this, ignore it. Your account stays inactive until you set a password.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
  return baseShell('Welcome', 'wave', 'Welcome to ClassPulse', content);
}

async function sendWelcomeEmail(to, userName, userEmail, token) {
  const client = getResendClient();
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

  const { data, error } = await client.emails.send({
    from: process.env.FROM_EMAIL || 'ClassPulse <onboarding@resend.dev>',
    to,
    subject: 'ClassPulse — Welcome, Set Your Password',
    html: welcomeTemplate(userName, userEmail, resetUrl),
  });

  if (error) {
    console.error('Welcome email send error:', error);
    throw new Error(error.message || 'Failed to send welcome email');
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('Welcome email sent to:', to);
  }

  return data;
}

module.exports = { sendResetEmail, sendWelcomeEmail };

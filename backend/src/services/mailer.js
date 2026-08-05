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

function iconImg(name, size = 18) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  const src = `${backendUrl}/api/assets/icons/${name}.svg`;
  return `<img src="${src}" alt="" width="${size}" height="${size}" style="display:block;border:0;" />`;
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

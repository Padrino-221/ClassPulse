const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  } else {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    console.log('Ethereal email:', testAccount.user);
  }
  return transporter;
}

function resetTemplate(resetUrl) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#F4F7F6;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7F6;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background:#00B66E;width:40px;height:40px;border-radius:8px;font-size:20px;font-weight:800;color:#FFFFFF;line-height:40px;text-align:center;">&#10003;</td>
                  <td style="padding-left:10px;font-size:22px;font-weight:700;color:#2D3748;line-height:40px;">ClassPulse</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#FFFFFF;border-radius:16px;padding:36px 32px 32px;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
              <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#2D3748;line-height:1.3;">Password Reset</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#718096;line-height:1.6;">You requested a password reset. Click below to set a new one.</p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center" style="background:#00B66E;border-radius:8px;padding:12px 32px;">
                    <a href="${resetUrl}" style="color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;display:inline-block;">Reset Password</a>
                  </td>
                </tr>
              </table>
              <hr style="border:none;border-top:1px solid #EDF2F7;margin:0 0 20px;">
              <p style="margin:0 0 6px;font-size:13px;color:#718096;line-height:1.5;">This link expires in <strong style="color:#2D3748;">1 hour</strong>.</p>
              <p style="margin:0;font-size:13px;color:#718096;line-height:1.5;">If you didn't request this, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#A0AEC0;">ClassPulse &mdash; Attendance Management System</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendResetEmail(to, token, userType) {
  const transport = await getTransporter();
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

  const info = await transport.sendMail({
    from: process.env.FROM_EMAIL || 'classpulse@noreply.com',
    to,
    subject: 'ClassPulse - Password Reset',
    html: resetTemplate(resetUrl),
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log('Reset email URL:', resetUrl);
    console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
  }
}

module.exports = { sendResetEmail };

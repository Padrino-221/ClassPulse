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

function resetTemplate(resetUrl, userName) {
  const greeting = userName ? `Hello ${userName},` : 'Hello,';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Reset Your Password - ClassPulse</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#F4F7F6;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F4F7F6;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:480px;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center" style="background:#0730A3;width:44px;height:44px;border-radius:12px;font-size:18px;font-weight:800;color:#FFFFFF;line-height:44px;text-align:center;">C</td>
                  <td style="padding-left:12px;font-size:24px;font-weight:700;color:#1A202C;line-height:44px;letter-spacing:-0.02em;">ClassPulse</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:#FFFFFF;border-radius:20px;padding:0;box-shadow:0 4px 24px rgba(0,0,0,0.06);overflow:hidden;">
              <!-- Blue Header Accent -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:linear-gradient(135deg,#0730A3 0%,#0A1628 100%);padding:32px 40px 28px;text-align:center;">
                    <!-- Shield Icon -->
                    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 16px;">
                      <tr>
                        <td align="center" style="background:rgba(255,255,255,0.15);width:56px;height:56px;border-radius:50%;">
                          <span style="font-size:28px;line-height:56px;display:block;">&#128737;</span>
                        </td>
                      </tr>
                    </table>
                    <h1 style="margin:0;font-size:24px;font-weight:700;color:#FFFFFF;line-height:1.3;letter-spacing:-0.01em;">Reset Your Password</h1>
                  </td>
                </tr>
              </table>
              <!-- Content -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:40px 40px 32px;">
                    <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1A202C;line-height:1.5;">${greeting}</p>
                    <p style="margin:0 0 24px;font-size:15px;color:#4A5568;line-height:1.7;">We received a request to reset the password for your ClassPulse account. Click the button below to set a new password.</p>
                    <!-- Button -->
                    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 32px;">
                      <tr>
                        <td align="center" style="background:#0730A3;border-radius:12px;padding:16px 40px;">
                          <a href="${resetUrl}" style="color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;display:inline-block;letter-spacing:0.01em;">Reset Password</a>
                        </td>
                      </tr>
                    </table>
                    <!-- Divider -->
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="border-top:1px solid #E2E8F0;padding:0;"></td>
                      </tr>
                    </table>
                    <!-- Expiry Notice -->
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:24px;">
                      <tr>
                        <td>
                          <table cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td style="vertical-align:top;padding-right:10px;padding-top:2px;">
                                <span style="font-size:16px;line-height:1;">&#9200;</span>
                              </td>
                              <td>
                                <p style="margin:0;font-size:14px;color:#4A5568;line-height:1.6;">This link expires in <strong style="color:#1A202C;">1 hour</strong>.</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    <!-- Security Notice -->
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:16px;">
                      <tr>
                        <td style="background:#F7FAFC;border-radius:12px;padding:20px 24px;">
                          <table cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td style="vertical-align:top;padding-right:12px;padding-top:2px;">
                                <span style="font-size:16px;line-height:1;">&#128274;</span>
                              </td>
                              <td>
                                <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#1A202C;line-height:1.5;">Security Notice</p>
                                <p style="margin:0;font-size:13px;color:#718096;line-height:1.6;">If you didn't request this password reset, please ignore this email or contact our support team. Your password will remain unchanged.</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:32px;">
              <p style="margin:0 0 8px;font-size:13px;color:#718096;line-height:1.5;">ClassPulse &mdash; Attendance Management System</p>
              <p style="margin:0;font-size:12px;color:#A0AEC0;line-height:1.5;">This is an automated message, please do not reply.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendResetEmail(to, token, userType, userName = null) {
  const transport = await getTransporter();
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

  const info = await transport.sendMail({
    from: process.env.FROM_EMAIL || 'classpulse@noreply.com',
    to,
    subject: 'ClassPulse - Reset Your Password',
    html: resetTemplate(resetUrl, userName),
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log('Reset email URL:', resetUrl);
    console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
  }

  return info;
}

module.exports = { sendResetEmail };

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.APP_EMAIL,
    pass: process.env.APP_EMAIL_PASS,
  },
});

/**
 * Sends a geofence breach security alert email with OTP.
 * @param {string} to - employee email
 * @param {string} empName - employee name
 * @param {string} otp - the one-time password
 * @param {number} lat - breach latitude
 * @param {number} lng - breach longitude
 */
const sendBreachAlertEmail = async (to, empName, otp, lat, lng) => {
  const mapLink = `https://www.google.com/maps?q=${lat},${lng}`;
  const timestamp = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "full",
    timeStyle: "medium",
  });

  const mailOptions = {
    from: `"SecureTrack Security" <${process.env.APP_EMAIL}>`,
    to,
    subject: `🚨 URGENT: Geofence Breach Alert — ${empName}`,
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Security Alert</title>
</head>
<body style="margin:0; padding:0; background:#f4f4f4; font-family:Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08);">
          
          <!-- Alert Header -->
          <tr>
            <td style="background:linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding:28px 30px; text-align:center;">
              <p style="margin:0 0 8px 0; font-size:32px;">🚨</p>
              <h1 style="margin:0; color:#fff; font-size:22px; font-weight:700; letter-spacing:1px;">SECURITY ALERT</h1>
              <p style="margin:8px 0 0 0; color:#fca5a5; font-size:13px;">Geofence Boundary Violated</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:30px;">
              <p style="font-size:15px; color:#374151; margin:0 0 20px 0;">
                Hello <strong>${empName}</strong>,
              </p>
              <p style="font-size:14px; color:#6b7280; line-height:1.7; margin:0 0 20px 0;">
                Our system has detected that your device has moved <strong>beyond the authorized 200-meter geofence boundary</strong> of the campus perimeter. Immediate security verification is required.
              </p>

              <!-- Alert Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px 0; font-size:11px; font-weight:700; color:#dc2626; letter-spacing:1px; text-transform:uppercase;">⚠ Breach Details</p>
                    <p style="margin:0 0 4px 0; font-size:13px; color:#374151;"><strong>Employee:</strong> ${empName}</p>
                    <p style="margin:0 0 4px 0; font-size:13px; color:#374151;"><strong>Time:</strong> ${timestamp}</p>
                    <p style="margin:0 0 4px 0; font-size:13px; color:#374151;"><strong>GPS Coordinates:</strong> ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E</p>
                    <p style="margin:0; font-size:13px; color:#374151;"><a href="${mapLink}" style="color:#2563eb; text-decoration:none; font-weight:600;">📍 View Location on Google Maps</a></p>
                  </td>
                </tr>
              </table>

              <!-- OTP Box -->
              <p style="font-size:13px; color:#374151; margin:0 0 12px 0; font-weight:600;">Enter this One-Time Password in the verification prompt to confirm authorized device possession:</p>
              <div style="text-align:center; margin:0 0 24px 0;">
                <div style="display:inline-block; background:#111827; padding:18px 36px; border-radius:10px;">
                  <span style="font-size:42px; font-weight:900; letter-spacing:12px; color:#ffffff; font-family:monospace;">${otp}</span>
                </div>
                <p style="margin:10px 0 0 0; font-size:12px; color:#9ca3af;">Valid for <strong>5 minutes only</strong>. Do not share with anyone.</p>
              </div>

              <!-- Warning -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; margin-bottom:20px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0; font-size:13px; color:#92400e; line-height:1.6;">
                      ⚠️ <strong>If you did not trigger this alert</strong>, your device may be compromised. An automatic security alarm has been sent to the administrator. Do NOT share this OTP with anyone.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="font-size:13px; color:#9ca3af; margin:0;">Failure to verify within 5 minutes will escalate this to a <strong style="color:#dc2626;">SECURITY ALARM</strong> on the admin dashboard.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb; padding:16px 30px; text-align:center; border-top:1px solid #f3f4f6;">
              <p style="margin:0; font-size:11px; color:#9ca3af;">SecureTrack — Automated Security System</p>
              <p style="margin:4px 0 0 0; font-size:11px; color:#d1d5db;">Do not reply to this email.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[BREACH EMAIL] Security alert sent to ${to} for ${empName}`);
  } catch (error) {
    console.error(`[BREACH EMAIL] Failed to send to ${to}:`, error.message);
  }
};

module.exports = sendBreachAlertEmail;

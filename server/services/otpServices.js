const nodemailer = require("nodemailer")

const sendOTPServices = async (to, subject, otp) => {

  // Create transporter here so env vars are guaranteed to be loaded
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.APP_EMAIL,
      pass: process.env.APP_EMAIL_PASS
    }
  })

  const mailOptions = {
    from: process.env.APP_EMAIL,
    to,
    subject,
    html: ` <!DOCTYPE html>

<html>
<head>
  <meta charset="UTF-8">
  <title>OTP Verification</title>
</head>

<body style="margin:0; padding:0; background:#f4f4f4; font-family:Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
    <tr>
      <td align="center">
    <table width="500" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:8px; overflow:hidden;">
      
      <!-- Header -->
      <tr>
        <td style="background:#111827; color:#ffffff; text-align:center; padding:20px;">
          <h2 style="margin:0;">Verify Your Account</h2>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:30px; text-align:center; color:#333;">
          
          <p style="font-size:16px; margin-bottom:20px;">
            Use the OTP below to complete your verification:
          </p>

          <!-- OTP BOX -->
          <div style="font-size:32px; font-weight:bold; letter-spacing:8px; background:#f3f4f6; padding:15px 20px; display:inline-block; border-radius:6px; color:#111827;">
            ${otp}
          </div>

          <p style="margin-top:25px; font-size:14px; color:#555;">
            This OTP is valid for <strong>5 minutes</strong>.
          </p>

          <p style="margin-top:15px; font-size:14px; color:#999;">
            Do not share this code with anyone.
          </p>

        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f9fafb; text-align:center; padding:15px; font-size:12px; color:#888;">
          If you didn't request this, you can ignore this email.
        </td>
      </tr>

    </table>

  </td>
</tr>


  </table>

</body>
</html>
`
  }

  // Let errors bubble up so the caller's .catch(console.error) logs them in Render
  const result = await transporter.sendMail(mailOptions)
  console.log("✅ OTP email sent to:", to);
  return result;
}

module.exports = sendOTPServices
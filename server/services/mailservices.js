const nodemailer = require("nodemailer")

const sendMailServices = async (to, subject, empname) => {

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.APP_EMAIL,
      pass: process.env.APP_EMAIL_PASS
    }
  })

  console.log("DEBUG EMAIL:", process.env.APP_EMAIL);
  console.log("DEBUG PASS:", process.env.APP_EMAIL_PASS ? "Password Loaded" : "Password MISSING");

  const mailOptions = {
    from: process.env.APP_EMAIL,
    to,
    subject,
    html: `<!DOCTYPE html>

<html>
<head>
  <meta charset="UTF-8">
  <title>Employee Account Created</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial, sans-serif;">

  <table align="center" width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
    <tr>
      <td align="center">


    <table width="500" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.05);">
      
      <!-- Header -->
      <tr>
        <td style="background:#4f46e5; color:#ffffff; padding:20px; text-align:center;">
          <h2 style="margin:0;"> Your Employee Account Created Successfully ${empname}</h2>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:30px; color:#333;">
          <h3 style="margin-top:0;">Hello,</h3>
          
          <p style="line-height:1.6;">
            Your employee account has been successfully created. You can now access the system and start using the platform.
          </p>

          <p style="line-height:1.6;">
            Click the button below to login and get started:
          </p>

          <!-- Button -->
          <div style="text-align:center; margin:30px 0;">
            <a href="http://localhost:3000/login" 
               style="background:#4f46e5; color:#ffffff; padding:12px 25px; text-decoration:none; border-radius:5px; display:inline-block;">
              Login Now
            </a>
          </div>

          <p style="line-height:1.6;">
            If you did not expect this account, please contact the administrator.
          </p>

          <p style="margin-top:30px;">
            Regards,<br/>
            <strong>HR Team</strong>
          </p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f1f1f1; text-align:center; padding:15px; font-size:12px; color:#777;">
          © 2026 Your Company. All rights reserved.
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

  const result = await transporter.sendMail(mailOptions)
  console.log("✅ Registration mail sent to:", to);
  return result;
}

module.exports = sendMailServices
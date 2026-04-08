const axios = require("axios");

const sendMailServices = async (to, subject, empname) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.APP_EMAIL;

  if (!apiKey) {
    console.error("❌ BREVO_API_KEY is missing!");
    return { success: false, error: "API Key missing" };
  }

  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: { name: "HR Attendance System", email: senderEmail },
        to: [{ email: to.trim() }],
        subject: subject,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #4f46e5;">Welcome to the Team, ${empname}!</h2>
            <p>Your employee account has been successfully created.</p>
            <p>You can now access the system at the link below:</p>
            <div style="margin: 20px 0;">
              <a href="https://attendance-tawny-eight.vercel.app/login" 
                 style="background: #4f46e5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Login to Dashboard
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">If you have any issues logging in, please contact your administrator.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999;">Regards,<br>HR Department</p>
          </div>
        `,
      },
      {
        headers: {
          "api-key": apiKey.trim(),
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Brevo Registration mail sent successfully. Id:", response.data.messageId);
    return { success: true, data: response.data };
  } catch (err) {
    console.error("❌ Brevo API Error (Mail):", err.response ? err.response.data : err.message);
    return { success: false, error: err.message };
  }
};

module.exports = sendMailServices;
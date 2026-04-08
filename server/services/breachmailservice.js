const { Resend } = require("resend");

const sendBreachAlertEmail = async (to, empName, otp, lat, lng) => {
  const resend = new Resend(process.env.RESEND_API_KEY);

  const timestamp = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "full",
    timeStyle: "medium",
  });

  const html = `
    <h1>Security Alert</h1>
    <p>Hello <strong>${empName}</strong>,</p>
    <p>Geofence breach detected at ${timestamp}.</p>
    <p>Location: ${lat}, ${lng}</p>
    <p>Verification OTP: <strong>${otp}</strong></p>
  `;

  const { data, error } = await resend.emails.send({
    from: "Attendance System <onboarding@resend.dev>",
    to,
    subject: `URGENT: Geofence Breach Alert for ${empName}`,
    html,
  });

  if (error) {
    console.error("❌ Breach email error:", error);
    throw error;
  }

  console.log(`✅ [BREACH EMAIL] Security alert sent to ${to} | ID:`, data.id);
  return data;
};

module.exports = sendBreachAlertEmail;

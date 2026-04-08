const { Resend } = require("resend");

const sendOTPServices = async (to, subject, otp) => {
  // Debug: verify key loading
  if (!process.env.RESEND_API_KEY) {
     console.error("❌ RESEND_API_KEY is missing from environment variables!");
     throw new Error("RESEND_API_KEY is missing");
  }

  console.log(`📧 Attempting to send OTP to: ${to} using Resend...`);

  const resend = new Resend(process.env.RESEND_API_KEY.trim());

  try {
    const { data, error } = await resend.emails.send({
      from: "Attendance System <onboarding@resend.dev>",
      to: to.trim(),
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
          <h2 style="color: #4f46e5;">Verification OTP</h2>
          <p>Hello,</p>
          <p>Your One-Time Password (OTP) for login is:</p>
          <div style="font-size: 24px; font-weight: bold; background: #f3f4f6; padding: 10px; display: inline-block; border-radius: 5px; color: #111827;">
            ${otp}
          </div>
          <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">This OTP is valid for 5 minutes. Do not share it with anyone.</p>
        </div>
      `
    });

    if (error) {
      console.error("❌ Resend API Error:", JSON.stringify(error, null, 2));
      return { success: false, error };
    }

    console.log("✅ OTP email sent successfully. ID:", data.id);
    return { success: true, data };
    
  } catch (err) {
    console.error("❌ Resend Network/Execution Error:", err.message);
    return { success: false, error: err.message };
  }
};

module.exports = sendOTPServices;
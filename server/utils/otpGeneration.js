const otpService = () => {
  const OTP = Math.floor(1000 + Math.random() * 9000);
  return OTP
}

module.exports = otpService
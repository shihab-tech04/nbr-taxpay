/** Existing browser journeys begin with the demo account's first-login step
 * already completed. The dedicated OTP acceptance test removes user1's key. */
export const demoLoginOtpCompletedState = {
  cookies: [],
  origins: [{
    origin: 'http://127.0.0.1:4173',
    localStorage: Array.from({ length: 30 }, (_, index) => ({
      name: `korbritto.demo-login-otp.v1:user${index + 1}`,
      value: 'complete',
    })),
  }],
};

/**
 * Resend API key from env. Prefer RESEND_API_KEY; also accepts common alternates
 * (typo RESND_API_KEY, AIWEBD / aiwebd).
 */
export function getResendApiKey(): string | undefined {
  const key =
    process.env.RESEND_API_KEY?.trim() ||
    process.env.RESND_API_KEY?.trim() ||
    process.env.AIWEBD?.trim() ||
    process.env.aiwebd?.trim();
  return key || undefined;
}

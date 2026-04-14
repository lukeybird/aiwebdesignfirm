/** Clears httpOnly dev cookie and localStorage dev session (call before redirect to login). */
export async function logoutDeveloperClient(): Promise<void> {
  try {
    await fetch('/api/auth/developer/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    /* ignore network errors */
  }
  if (typeof window !== 'undefined') {
    localStorage.removeItem('devAuth');
    localStorage.removeItem('devAuthTime');
  }
}

/** Server-only validation for developer login (booking admin + /developer/* UI). */
export function isValidDeveloperCredentials(username: string, password: string): boolean {
  const u = process.env.DEVELOPER_LOGIN_EMAIL ?? 'luke@webstarts.com';
  const p = process.env.DEVELOPER_LOGIN_PASSWORD ?? 'Dev74589900!';
  return username === u && password === p;
}

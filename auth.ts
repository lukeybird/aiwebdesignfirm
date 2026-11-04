import NextAuth, { type NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { allowAuthAttempt, authenticatePassword, normalizeEmail } from '@/lib/password-accounts';
import { getUserByGoogleSub, getUserById, upsertGoogleUser } from '@/lib/site-users';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      displayName?: string | null;
    };
  }
}


function sanitizeAuthUrlEnv() {
  for (const key of ['AUTH_URL', 'NEXTAUTH_URL'] as const) {
    const value = (process.env[key] || '').trim();
    // Ignore placeholders like "AUTH_URL" that are not real URLs.
    if (value && !/^https?:\/\//i.test(value)) {
      delete process.env[key];
    }
  }
}
sanitizeAuthUrlEnv();

const googleId = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID || '';
const googleSecret = process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '';

export function isGoogleAuthConfigured() {
  return Boolean(googleId && googleSecret && authSecret);
}

const providers: NextAuthConfig['providers'] = [Credentials({
  credentials: { email: { type: 'email' }, password: { type: 'password' } },
  async authorize(credentials, request) {
    const ip = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    if (!(await allowAuthAttempt('login-ip:' + ip, 60))) return null;
    const user = await authenticatePassword(normalizeEmail(credentials.email), typeof credentials.password === 'string' ? credentials.password : '');
    return user ? { id: user.id, name: user.display_name, email: user.email, image: user.avatar_url } : null;
  },
})];
if (googleId && googleSecret) {
  providers.push(
    Google({
      clientId: googleId,
      clientSecret: googleSecret,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret || 'dev-only-missing-auth-secret',
  providers,
  pages: {
    signIn: '/login',
    error: '/account',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'credentials') return Boolean(user.id);
      if (account?.provider !== 'google' || !account.providerAccountId) return false;
      try {
        await upsertGoogleUser({
          googleSub: account.providerAccountId,
          email: user.email || (profile as { email?: string })?.email || '',
          name: user.name || (profile as { name?: string })?.name || null,
          image: user.image || (profile as { picture?: string })?.picture || null,
        });
        return true;
      } catch (err) {
        console.error('Google sign-in upsert failed:', err);
        return false;
      }
    },
    async jwt({ token, account, user }) {
      const sub = account?.provider === 'google' ? account.providerAccountId : undefined;
      const userId = account?.provider === 'credentials' ? user?.id : token.userId as string | undefined;
      if (!sub && !userId) return token;
      try {
        const row = sub ? await getUserByGoogleSub(sub) : await getUserById(userId!);
        if (row) {
          token.userId = row.id;
          token.displayName = row.display_name;
          token.picture = row.avatar_url || token.picture;
          token.email = row.email || token.email;
        }
      } catch (err) {
        console.error('Auth jwt user lookup failed:', err);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.userId as string) || '';
        session.user.displayName = (token.displayName as string | null) ?? session.user.name ?? null;
        if (token.picture) session.user.image = token.picture as string;
      }
      return session;
    },
  },
  trustHost: true,
});

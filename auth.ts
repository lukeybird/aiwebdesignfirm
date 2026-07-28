import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { getUserByGoogleSub, upsertGoogleUser } from '@/lib/site-users';

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: '/account',
    error: '/account',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
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
    async jwt({ token, account }) {
      const sub = account?.providerAccountId || (token.sub as string | undefined);
      if (!sub) return token;
      try {
        const row = await getUserByGoogleSub(sub);
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

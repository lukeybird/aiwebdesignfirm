import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ExternalLink, ShieldCheck, UserRound } from 'lucide-react';
import { isDeveloperAuthenticatedFromCookies } from '@/lib/developer-auth';
import { listSiteUsers } from '@/lib/site-users';

export const metadata: Metadata = {
  title: 'Google Accounts',
  description: 'Developer-only view of Google-linked Territory Game accounts.',
};

export const dynamic = 'force-dynamic';

function formatDate(value: string | Date) {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function ActivityAccountsPage() {
  const authenticated = await isDeveloperAuthenticatedFromCookies();
  if (!authenticated) {
    redirect('/login/developer?next=/activity/accounts');
  }

  const users = await listSiteUsers();

  return (
    <main className="min-h-[100dvh] bg-[#0a0a0f] text-[#f5f5f7]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-cyan-300">
              <UserRound className="h-5 w-5" />
              <span className="text-sm font-medium uppercase tracking-wider">Territory Game</span>
            </div>
            <h1 className="font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight sm:text-4xl">
              Google Accounts
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/60">
              {users.length} linked {users.length === 1 ? 'account' : 'accounts'}. This page shows the
              Google profile data saved by this app and profile details users add here.
            </p>
          </div>
          <Link
            href="/activity"
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Activity
          </Link>
        </header>

        <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-3 text-sm text-emerald-100/80">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
          <p>
            Google sign-in provides an account ID, email, name, and profile image. The app does not
            receive Google passwords and does not store OAuth access tokens. Display names, character
            pictures, and bios may be edited after sign-in.
          </p>
        </div>

        {users.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-white/50">
            No one has linked a Google account yet.
          </div>
        ) : (
          <div className="grid gap-4">
            {users.map((user) => (
              <article
                key={user.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.2)]"
              >
                <div className="flex flex-col gap-5 md:flex-row">
                  <div className="flex min-w-0 items-center gap-4 md:w-72 md:shrink-0">
                    {user.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={user.avatar_url}
                        alt=""
                        className="h-16 w-16 shrink-0 rounded-xl border border-white/15 object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-cyan-950/50 text-xl font-semibold text-cyan-100">
                        {user.display_name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold">{user.display_name}</h2>
                      <a
                        href={`mailto:${user.email}`}
                        className="block truncate text-sm text-cyan-200/70 hover:text-cyan-100"
                      >
                        {user.email}
                      </a>
                    </div>
                  </div>

                  <dl className="grid min-w-0 flex-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-white/35">Google account ID</dt>
                      <dd className="mt-1 break-all font-mono text-xs text-white/75">{user.google_sub}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-white/35">Internal account ID</dt>
                      <dd className="mt-1 break-all font-mono text-xs text-white/75">{user.id}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-white/35">Email</dt>
                      <dd className="mt-1 break-all text-white/80">{user.email}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-white/35">Created</dt>
                      <dd className="mt-1 text-white/80">{formatDate(user.created_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-white/35">Last updated</dt>
                      <dd className="mt-1 text-white/80">{formatDate(user.updated_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-white/35">Profile image</dt>
                      <dd className="mt-1">
                        {user.avatar_url ? (
                          <a
                            href={user.avatar_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-cyan-200/75 hover:text-cyan-100"
                          >
                            Open image
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-white/40">None</span>
                        )}
                      </dd>
                    </div>
                    <div className="sm:col-span-2 xl:col-span-3">
                      <dt className="text-xs uppercase tracking-wider text-white/35">Bio</dt>
                      <dd className="mt-1 whitespace-pre-wrap text-white/80">
                        {user.bio || <span className="text-white/40">No bio shared</span>}
                      </dd>
                    </div>
                  </dl>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

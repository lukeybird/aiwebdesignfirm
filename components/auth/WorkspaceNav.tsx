'use client';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
export default function WorkspaceNav() {
  return <header className="border-b border-slate-800"><nav aria-label="Workspace navigation" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-6 py-5">
    <Link href="/product" className="font-bold tracking-tight text-white">AI Web Design Firm</Link>
    <div className="flex gap-5 text-sm text-slate-300"><Link href="/product">Workspace</Link><Link href="/settings">Settings & billing</Link><button onClick={() => signOut({ callbackUrl: '/login' })}>Sign out</button></div>
  </nav></header>;
}

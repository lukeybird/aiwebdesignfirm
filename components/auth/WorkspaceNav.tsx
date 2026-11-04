'use client';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Brand from './Brand';
export default function WorkspaceNav() {
  const pathname = usePathname();
  return <header className="brand-header"><nav aria-label="Workspace navigation" className="brand-container brand-navigation">
    <Brand href="/product" />
    <div className="brand-nav-links"><Link aria-current={pathname === '/product' ? 'page' : undefined} href="/product">Workspace</Link><Link aria-current={pathname === '/settings' ? 'page' : undefined} href="/settings">Settings & billing</Link><button className="brand-button brand-button-quiet" onClick={() => signOut({ callbackUrl: '/login' })}>Sign out</button></div>
  </nav></header>;
}

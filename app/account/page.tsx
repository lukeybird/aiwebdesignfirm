import type { Metadata } from 'next';
import AccountClient from './AccountClient';

export const metadata: Metadata = {
  title: 'Account',
  description: 'Sign in with Google and edit your Territory Game profile.',
};

export default function AccountPage() {
  return <AccountClient />;
}

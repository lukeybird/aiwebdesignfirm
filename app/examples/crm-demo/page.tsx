import type { Metadata } from 'next';
import CrmDemoApp from './CrmDemoApp';

export const metadata: Metadata = {
  title: 'Sample CRM demo',
  description:
    'This is a sample CRM you can click through—contacts, deals, and tasks for illustration. Demo only; nothing is saved.',
};

export default function CrmDemoPage() {
  return <CrmDemoApp />;
}

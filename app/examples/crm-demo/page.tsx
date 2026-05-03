import type { Metadata } from 'next';
import CrmDemoApp from './CrmDemoApp';

export const metadata: Metadata = {
  title: 'Sample CRM demo',
  description:
    'Click through a fictional CRM with sample contacts, deals, and tasks. Demo only — no data is saved.',
};

export default function CrmDemoPage() {
  return <CrmDemoApp />;
}

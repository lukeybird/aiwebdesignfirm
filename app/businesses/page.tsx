import type { Metadata } from 'next';
import BusinessesWorkspace from './BusinessesWorkspace';

export const metadata: Metadata = {
  title: 'Business ideas',
  description: 'Track business ideas, roadmap steps, and notes.',
};

export default function BusinessesPage() {
  return <BusinessesWorkspace />;
}

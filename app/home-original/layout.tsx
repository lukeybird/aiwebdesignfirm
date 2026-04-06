import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Classic homepage',
  description: 'Original AI Web Design Firm landing page with portfolio and project flow.',
};

export default function HomeOriginalLayout({ children }: { children: ReactNode }) {
  return children;
}

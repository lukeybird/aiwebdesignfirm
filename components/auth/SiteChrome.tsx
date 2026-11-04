'use client';

import { usePathname } from 'next/navigation';
import SiteAccountBar from './SiteAccountBar';
import AiImplementationChatWidget from '@/components/chat/AiImplementationChatWidget';

export default function SiteChrome({ part }: { part: 'account' | 'chat' }) {
  const pathname = usePathname();
  if (pathname === '/product' || pathname === '/start') return null;
  return part === 'account' ? <SiteAccountBar /> : <AiImplementationChatWidget />;
}

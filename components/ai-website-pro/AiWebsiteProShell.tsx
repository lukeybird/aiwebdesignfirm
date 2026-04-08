'use client';

import { Toaster } from 'sonner';
import AiWebsiteProHome from '@/components/ai-website-pro/AiWebsiteProHome';

export default function AiWebsiteProShell() {
  return (
    <>
      <AiWebsiteProHome />
      <Toaster richColors theme="dark" position="top-center" />
    </>
  );
}

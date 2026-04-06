import type { Metadata } from 'next';
import AiWebsiteProShell from '@/components/ai-website-pro/AiWebsiteProShell';

export const metadata: Metadata = {
  title: 'aiWebDF | AI-Optimized Websites & Chat',
  description:
    'High-converting websites with an AI Q&A chatbot. SEO plus LLM optimization for ChatGPT, Claude, and more. Live in 7 days or less.',
};

export default function Home() {
  return <AiWebsiteProShell />;
}

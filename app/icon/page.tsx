import type { Metadata } from 'next';
import { Syne, Outfit } from 'next/font/google';
import IconMaker from './IconMaker';
import './icon.css';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-icon-display',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-icon-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Icon Tournament',
  description:
    'Tournament-select the best website icons for a business category, then draw each as SVG one at a time.',
};

export default function IconPage() {
  return (
    <main className={`icon-app ${syne.variable} ${outfit.variable}`}>
      <IconMaker />
    </main>
  );
}

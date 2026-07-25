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
  title: 'Icon Maker',
  description: 'Enter a category to generate a named set of SVG icons for your website.',
};

export default function IconPage() {
  return (
    <main className={`icon-app ${syne.variable} ${outfit.variable}`}>
      <IconMaker />
    </main>
  );
}

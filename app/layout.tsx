import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Advanced AI Web Design Firm | Fast, High-Quality Websites",
  description: "Over 15 years of experience building and maintaining functional websites for specific markets. Fast turnarounds, detailed and high-quality work guaranteed.",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favcon/favicon.ico', type: 'image/x-icon' },
      { url: '/favcon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favcon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/favcon/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


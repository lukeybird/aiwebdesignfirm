import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Web Design Firm | Fast, High-Quality Websites",
  description: "Over 15 years of experience building and maintaining functional websites for specific markets. Fast turnarounds, detailed and high-quality work guaranteed.",
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
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


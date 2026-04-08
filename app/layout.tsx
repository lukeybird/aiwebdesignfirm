import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AI Web Design Firm",
    template: "%s | AI Web Design Firm",
  },
  description:
    "Over 15 years of experience building and maintaining functional websites for specific markets. Fast turnarounds, detailed and high-quality work guaranteed.",
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
};

/** Tab / mobile browser chrome — matches aiWebDF dark background */
export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="font-sans antialiased min-h-[100dvh] bg-[#0a0a0f] text-[#f5f5f7]">
        {children}
      </body>
    </html>
  );
}


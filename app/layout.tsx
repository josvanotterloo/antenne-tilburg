import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";

import "./globals.css";

// Space Grotesk = the human voice (headings, prose); JetBrains Mono = the machine
// voice (nav, data, prices, labels). See DESIGN.md §3.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Antenne Recordshop Tilburg",
    template: "%s · Antenne Tilburg",
  },
  description:
    "Antenne Recordshop — electronic-music vinyl & tapes in Tilburg, inside Sam-Sam vintage.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}

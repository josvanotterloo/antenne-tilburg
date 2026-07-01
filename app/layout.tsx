import type { Metadata } from "next";

import "./globals.css";

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
    <html lang="nl">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}

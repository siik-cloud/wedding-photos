import type { Metadata, Viewport } from "next";
import "./globals.css";
import MobileNav from "@/components/MobileNav";
import { inter, cormorant } from "@/lib/fonts";

export const viewport: Viewport = {
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Fotky zo svadby Katky a Šimona",
  description: "Nahraj svoje fotky a videá zo svadby.",
  openGraph: {
    title: "Fotky zo svadby Katky a Šimona",
    description: "Nahraj svoje fotky a videá zo svadby.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
     * Both CSS variables must be on <html> so they're available to every
     * descendant. The `font-sans` class on <body> ensures Inter is the
     * baseline for all text — Cormorant is opt-in via `font-heading`.
     */
    <html lang="sk" className={`${inter.variable} ${cormorant.variable}`}>
      <body className="font-sans min-h-screen bg-[#faf9f7] text-stone-900 antialiased">
        {children}
        <MobileNav />
      </body>
    </html>
  );
}

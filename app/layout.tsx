import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import MobileNav from "@/components/MobileNav";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-inter",
});

// Used for editorial / wedding copy — not for UI or buttons
const cormorant = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-cormorant",
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

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
    <html lang="sk" className={`${inter.variable} ${cormorant.variable}`}>
      <body className="min-h-screen bg-[#faf9f7] text-stone-900 antialiased">
        {children}
        <MobileNav />
      </body>
    </html>
  );
}

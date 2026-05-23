import type { Metadata, Viewport } from "next";
import "./globals.css";
import MobileNav from "@/components/MobileNav";

export const viewport: Viewport = {
  // Required for env(safe-area-inset-bottom) to work on iPhone notch/home bar
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Fotky zo svadby Katky a Šimona",
  description:
    "Nahraj svoje fotky a videá zo svadby. Pomôžeš nám zachytiť krásne momenty.",
  openGraph: {
    title: "Fotky zo svadby Katky a Šimona",
    description: "Nahraj svoje fotky a videá zo svadby.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sk">
      <body className="min-h-screen bg-[#faf9f7]">
        {children}
        <MobileNav />
      </body>
    </html>
  );
}

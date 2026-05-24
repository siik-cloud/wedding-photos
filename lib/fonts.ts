/**
 * Central font definitions.
 *
 * Import the exported objects into app/layout.tsx and apply both
 * `.variable` strings to <html> so their CSS custom properties are available
 * everywhere in the tree.
 *
 * Tailwind maps:
 *   font-heading  →  var(--font-cormorant)  →  Cormorant Garamond
 *   font-sans     →  var(--font-inter)      →  Inter  (everything else)
 */

import { Inter, Cormorant_Garamond } from "next/font/google";

export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-inter",
});

export const cormorant = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-cormorant",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

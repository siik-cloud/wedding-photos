"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Info, Camera, Images } from "lucide-react";

export default function MobileNav() {
  const pathname = usePathname();

  // Hide while a lightbox is open — GalleryView sets data-lightbox-open on <body>.
  const [lightboxOpen, setLightboxOpen] = useState(false);
  useEffect(() => {
    const check = () =>
      setLightboxOpen(document.body.hasAttribute("data-lightbox-open"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { attributes: true, attributeFilter: ["data-lightbox-open"] });
    return () => obs.disconnect();
  }, []);

  if (pathname.startsWith("/admin")) return null;
  if (lightboxOpen) return null;

  // "Info" is active when on the homepage (info lives there)
  const isHome    = pathname === "/";
  // "Nahrať" is active when on the dedicated /upload route
  const isUpload  = pathname === "/upload";
  // "Galéria" is active on /gallery
  const isGallery = pathname === "/gallery";

  return (
    <nav
      aria-label="Navigácia"
      className="fixed bottom-0 left-0 right-0 z-50
                 bg-white/96 backdrop-blur-md border-t border-sage-100
                 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-stretch max-w-xl mx-auto h-[60px]">

        {/* Info — links to homepage info section */}
        <Link
          href="/#wedding-info"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5
                      font-sans text-[11px] font-medium tracking-wide transition-colors
                      ${isHome ? "text-sage-800" : "text-stone-400 hover:text-stone-600"}`}
        >
          <Info
            className={`w-5 h-5 ${isHome ? "stroke-[2]" : "stroke-[1.5]"}`}
          />
          Info
        </Link>

        {/* Nahrať — scrolls to upload section on homepage */}
        <Link
          href="/#upload"
          className="flex items-center justify-center px-4"
        >
          <span
            className={`flex flex-col items-center justify-center gap-0.5 rounded-lg px-5 py-2
                        font-sans text-[11px] font-semibold tracking-wide transition-all
                        ${isUpload
                          ? "bg-sage-800 text-white shadow-lg shadow-sage-900/20"
                          : "bg-sage-800 text-white shadow-md shadow-sage-900/15"}`}
          >
            <Camera className="w-5 h-5" strokeWidth={1.5} />
            Nahrať
          </span>
        </Link>

        {/* Galéria */}
        <Link
          href="/gallery"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5
                      font-sans text-[11px] font-medium tracking-wide transition-colors
                      ${isGallery ? "text-sage-800" : "text-stone-400 hover:text-stone-600"}`}
        >
          <Images
            className={`w-5 h-5 ${isGallery ? "stroke-[2]" : "stroke-[1.5]"}`}
          />
          Galéria
        </Link>

      </div>
    </nav>
  );
}

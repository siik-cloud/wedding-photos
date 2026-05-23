"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Camera, Images, Info } from "lucide-react";

export default function MobileNav() {
  const pathname = usePathname();
  const router   = useRouter();

  // Never show on admin pages
  if (pathname.startsWith("/admin")) return null;

  const isUpload  = pathname === "/";
  const isGallery = pathname === "/gallery";

  const handleInfo = () => {
    if (pathname === "/") {
      document.getElementById("wedding-info")?.scrollIntoView({ behavior: "smooth" });
    } else {
      router.push("/#wedding-info");
    }
  };

  return (
    <nav
      aria-label="Hlavná navigácia"
      className="fixed bottom-0 left-0 right-0 z-50
                 bg-white/95 backdrop-blur-sm border-t border-gray-200
                 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-stretch max-w-xl mx-auto h-[62px]">

        {/* ── Gallery ─────────────────────────────────────────────────── */}
        <Link
          href="/gallery"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold
                      transition-colors
                      ${isGallery
                        ? "text-sage-600"
                        : "text-gray-400 hover:text-gray-600"}`}
        >
          <Images className={`w-6 h-6 ${isGallery ? "stroke-[2.5]" : ""}`} />
          Galéria
        </Link>

        {/* ── Upload — primary, centre ─────────────────────────────────── */}
        <Link
          href="/"
          className="flex flex-col items-center justify-center gap-0.5 px-6"
        >
          <span
            className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl px-5 py-2
                        transition-colors text-[11px] font-bold
                        ${isUpload
                          ? "bg-sage-500 text-white shadow-lg shadow-sage-300"
                          : "bg-sage-100 text-sage-700 hover:bg-sage-200"}`}
          >
            <Camera className="w-6 h-6" />
            Nahrať
          </span>
        </Link>

        {/* ── Info ────────────────────────────────────────────────────── */}
        <button
          onClick={handleInfo}
          aria-label="Svadobné info"
          className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px]
                     font-semibold text-gray-400 hover:text-gray-600 transition-colors"
        >
          <Info className="w-6 h-6" />
          Info
        </button>

      </div>
    </nav>
  );
}

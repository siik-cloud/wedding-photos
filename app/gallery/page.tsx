import Link from "next/link";
import { isGalleryEnabled } from "@/lib/supabase/server-client";
import GalleryView from "@/components/GalleryView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GalleryPage() {
  const galleryEnabled = await isGalleryEnabled();

  return (
    <main className="min-h-screen bg-gradient-to-b from-sage-50 to-[#faf9f7]">
      {/* Header */}
      <div className="bg-white border-b border-sage-100 py-8 px-4 text-center">
        <div className="text-3xl mb-2" aria-hidden>🌿💍🌿</div>
        <h1 className="text-2xl sm:text-3xl font-bold text-sage-800">
          Svadobná galéria
        </h1>
        <p className="mt-1 text-sage-600 font-semibold">
          Katka a Šimon · 6. júna 2026
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {galleryEnabled ? (
          <>
            <GalleryView />
            {/* Bottom padding so the sticky CTA doesn't overlap last row */}
            <div className="h-24" aria-hidden />
          </>
        ) : (
          /* ── Locked state ──────────────────────────────────────────── */
          <div className="max-w-sm mx-auto text-center py-16 px-4">
            <div className="text-6xl mb-6">💚</div>

            <h2 className="text-2xl font-bold text-sage-700 mb-4 leading-snug">
              Galériu sprístupníme
              <br />
              po svadbe.
            </h2>

            <p className="text-gray-500 text-base leading-relaxed mb-10">
              Zatiaľ nám môžeš nahrať svoje fotky a videá.
            </p>

            <Link
              href="/"
              className="block w-full py-5 bg-sage-500 text-white rounded-2xl
                         font-bold text-lg hover:bg-sage-600 transition-colors
                         text-center shadow-md shadow-sage-200"
            >
              Nahrať fotky
            </Link>
          </div>
        )}
      </div>

      {/* ── Sticky upload CTA (gallery enabled only) ─────────────────────── */}
      {galleryEnabled && (
        <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
          {/* Fade gradient behind button */}
          <div className="h-20 bg-gradient-to-t from-[#faf9f7]/90 to-transparent" />
          <div className="bg-[#faf9f7]/95 backdrop-blur-sm pb-safe-4 px-4 pb-4 pointer-events-auto">
            <Link
              href="/"
              className="block max-w-sm mx-auto py-4 bg-sage-500 text-white rounded-2xl
                         font-bold text-base text-center hover:bg-sage-600 transition-colors
                         shadow-lg shadow-sage-300"
            >
              📷 Nahrať ďalšie fotky
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

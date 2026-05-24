import Link from "next/link";
import { Lock } from "lucide-react";
import { isGalleryEnabled } from "@/lib/supabase/server-client";
import GalleryView from "@/components/GalleryView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GalleryPage() {
  const galleryEnabled = await isGalleryEnabled();

  return (
    <main className="min-h-screen bg-[#faf9f7]">

      {/* Top bar */}
      <div className="bg-white border-b border-sage-100 px-4">
        <div className="max-w-6xl mx-auto h-14 flex items-center justify-between">
          <div>
            <h1 className="font-sans text-sm font-semibold text-stone-900 tracking-tight">
              Galéria
            </h1>
            <p className="font-sans font-light text-xs text-stone-400 italic">
              Katka &amp; Šimon · 6. júna 2026
            </p>
          </div>
          <Link
            href="/#upload"
            className="font-sans text-xs font-medium text-stone-500 hover:text-sage-800
                       tracking-[0.02em] transition-colors px-3 py-1.5 border border-stone-200
                       rounded-lg hover:border-sage-300 hover:bg-sage-50"
          >
            Nahrať fotky
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {galleryEnabled ? (
          <>
            <GalleryView />
            <div className="h-28" aria-hidden />
          </>
        ) : (
          <div className="max-w-xs mx-auto text-center py-20 px-4">
            <div className="w-12 h-12 rounded-full bg-sage-100 flex items-center
                            justify-center mx-auto mb-6">
              <Lock className="w-5 h-5 text-sage-500" strokeWidth={1.5} />
            </div>
            <h2 className="font-sans font-light text-2xl text-stone-900 tracking-tight mb-3">
              Galéria nie je ešte dostupná
            </h2>
            <p className="font-sans text-stone-500 text-sm leading-relaxed mb-8">
              Fotky sprístupníme po svadbe. Medzitým môžeš nahrať svoje.
            </p>
            <Link
              href="/#upload"
              className="inline-flex items-center justify-center px-8 py-3 bg-sage-800
                         text-white rounded-lg font-sans font-medium text-sm tracking-[0.03em]
                         hover:bg-sage-900 transition-colors"
            >
              Nahrať fotky
            </Link>
          </div>
        )}
      </div>

      {/* Sticky upload CTA — gallery-open only */}
      {galleryEnabled && (
        <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
          <div className="h-16 bg-gradient-to-t from-[#faf9f7] to-transparent" />
          <div className="bg-[#faf9f7]/95 backdrop-blur-sm
                          pb-[calc(env(safe-area-inset-bottom)+64px)]
                          px-4 pt-1 pointer-events-auto">
            <div className="max-w-sm mx-auto">
              <Link
                href="/#upload"
                className="flex items-center justify-center gap-2 w-full py-3 bg-sage-800
                           text-white rounded-lg font-sans font-medium text-sm tracking-[0.03em]
                           hover:bg-sage-900 transition-colors
                           shadow-lg shadow-sage-900/20"
              >
                Nahrať fotky a videá
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

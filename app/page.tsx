import Link from "next/link";
import WeddingInfo from "@/components/WeddingInfo";
import UploadForm from "@/components/UploadForm";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#faf9f7]">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-sage-100 px-4 pt-14 pb-12 text-center">
        <p className="font-sans text-xs font-medium text-sage-600 tracking-[0.18em] uppercase mb-5">
          6. júna 2026
        </p>
        <h1 className="font-serif font-light text-4xl sm:text-5xl text-stone-900 leading-[1.15] tracking-tight">
          Fotky zo svadby
          <br />Katky&nbsp;&amp;&nbsp;Šimona
        </h1>
        <p className="mt-4 font-serif font-light text-stone-500 text-lg sm:text-xl max-w-sm mx-auto leading-relaxed">
          Zachyť momenty a zdieľaj fotky zo svojho uhla pohľadu.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-xs mx-auto">
          {/* Primary — scrolls to #upload on same page */}
          <a
            href="#upload"
            className="w-full sm:w-auto inline-flex items-center justify-center
                       px-8 py-3 bg-sage-800 text-white rounded-lg
                       font-sans font-medium text-sm tracking-[0.03em]
                       hover:bg-sage-900 active:bg-sage-900 transition-colors
                       shadow-md shadow-sage-900/15"
          >
            Nahrať fotky a videá
          </a>
          <Link
            href="/gallery"
            className="w-full sm:w-auto inline-flex items-center justify-center
                       px-8 py-3 border border-sage-700/40 text-sage-800 rounded-lg
                       font-sans font-medium text-sm tracking-[0.03em]
                       hover:bg-sage-50 hover:border-sage-700/60 transition-colors"
          >
            Otvoriť galériu
          </Link>
        </div>
      </section>

      <div className="max-w-xl mx-auto px-4 py-8 space-y-4 pb-28">

        {/* ── Upload form ──────────────────────────────────────────────────── */}
        <section
          id="upload"
          className="bg-white border border-sage-200 rounded-2xl p-6 sm:p-8
                     shadow-sm shadow-sage-900/5"
        >
          <h2 className="font-sans font-semibold text-stone-900 text-base mb-1 tracking-tight">
            Nahrať fotky a videá
          </h2>
          <p className="font-sans text-sm text-stone-500 mb-6">
            Pomôž nám zachytiť každý moment.
          </p>
          <UploadForm />
        </section>

        {/* ── Gallery card ─────────────────────────────────────────────────── */}
        <section className="bg-sage-50 border border-sage-200 rounded-2xl p-5
                            flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-sans font-medium text-stone-900 text-sm">Galéria</p>
            <p className="font-sans text-xs text-stone-500 mt-0.5">
              Pozri fotky a videá od ostatných hostí.
            </p>
          </div>
          <Link
            href="/gallery"
            className="flex-shrink-0 px-4 py-2 border border-sage-700/40 text-sage-800
                       rounded-lg font-sans text-sm font-medium tracking-[0.02em]
                       hover:bg-sage-100 hover:border-sage-700/60 transition-colors"
          >
            Otvoriť
          </Link>
        </section>

        {/* ── Wedding info ─────────────────────────────────────────────────── */}
        <WeddingInfo />

        <p className="font-sans text-center text-xs text-stone-400 pt-2 pb-4">
          Fotky sú uložené bezpečne. Galériu sprístupníme po svadbe.
        </p>

      </div>
    </main>
  );
}

import Link from "next/link";
import UploadForm from "@/components/UploadForm";
import WeddingInfo from "@/components/WeddingInfo";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-sage-50 to-[#faf9f7]">

      {/* ── Compact header ────────────────────────────────────────────── */}
      {/* Intentionally small — upload is the hero, not the title */}
      <div className="pt-8 pb-5 px-4 text-center">
        <div className="text-2xl mb-1.5" aria-hidden>🌿💍🌿</div>
        <h1 className="text-2xl sm:text-3xl font-bold text-sage-800 leading-snug">
          Fotky zo svadby
          <br className="sm:hidden" />
          {" "}Katky a Šimona
        </h1>
        <p className="mt-1 text-sage-600 font-semibold text-sm">6. júna 2026</p>
      </div>

      <div className="max-w-xl mx-auto px-4 space-y-4 pb-28">

        {/* ── 1. Upload — primary action ───────────────────────────────── */}
        <section
          id="upload"
          className="bg-white rounded-2xl shadow-sm border border-sage-100 p-6 sm:p-8"
          aria-label="Nahrať fotky a videá"
        >
          <div className="mb-5">
            <h2 className="text-xl font-bold text-gray-800">
              📸 Nahrať fotky a videá
            </h2>
            <p className="mt-1 text-sm text-gray-500 leading-relaxed">
              Zachytil/a si niečo krásne? Pošli nám to — každý moment sa počíta.
            </p>
          </div>
          <UploadForm />
        </section>

        {/* ── 2. Gallery card ──────────────────────────────────────────── */}
        <section
          className="bg-white rounded-2xl shadow-sm border border-sage-100 p-5 sm:p-6
                     flex items-center gap-4"
          aria-label="Galéria"
        >
          <div className="text-3xl flex-shrink-0" aria-hidden>🖼️</div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-800">Galéria zo svadby</h2>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
              Fotky a videá si pozrieš po svadbe.
            </p>
          </div>
          <Link
            href="/gallery"
            className="flex-shrink-0 px-4 py-2.5 bg-sage-100 text-sage-700 rounded-xl
                       font-bold text-sm hover:bg-sage-200 transition-colors whitespace-nowrap"
          >
            Otvoriť
          </Link>
        </section>

        {/* ── 3. Wedding info — accordion, compact ─────────────────────── */}
        <WeddingInfo />

        {/* ── Footer note ──────────────────────────────────────────────── */}
        <p className="text-center text-xs text-gray-400 pb-2">
          Fotky sú uložené bezpečne. Galériu sprístupníme po svadbe.
        </p>

      </div>
    </main>
  );
}

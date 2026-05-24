import Link from "next/link";
import UploadForm from "@/components/UploadForm";
import { ArrowLeft } from "lucide-react";

export default function UploadPage() {
  return (
    <main className="min-h-screen bg-[#faf9f7]">

      <div className="bg-white border-b border-sage-100 px-4">
        <div className="max-w-xl mx-auto h-14 flex items-center gap-3">
          <Link
            href="/"
            className="text-stone-400 hover:text-stone-700 transition-colors -ml-1 p-1"
            aria-label="Späť"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
          </Link>
          <span className="font-sans text-sm font-medium text-stone-600">
            Nahrať fotky a videá
          </span>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-8 pb-28">
        <div className="bg-white border border-sage-200 rounded-2xl p-6 sm:p-8
                        shadow-sm shadow-sage-900/5">
          <UploadForm />
        </div>

        <p className="font-sans text-center text-xs text-stone-400 mt-6">
          Fotky sú uložené bezpečne.{" "}
          <Link
            href="/gallery"
            className="underline underline-offset-2 hover:text-stone-600 transition-colors"
          >
            Otvoriť galériu
          </Link>
        </p>
      </div>
    </main>
  );
}

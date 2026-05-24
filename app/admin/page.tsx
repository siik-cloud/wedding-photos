import { isAdminAuthenticated } from "@/lib/auth";
import AdminPanel from "@/components/AdminPanel";
import AdminLogin from "@/components/AdminLogin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authenticated = await isAdminAuthenticated();

  return (
    <main className="min-h-screen bg-[#faf9f7]">
      <div className="bg-white border-b border-stone-200 px-4">
        <div className="max-w-5xl mx-auto h-14 flex items-center justify-between">
          <div>
            <span className="font-sans text-sm font-semibold text-stone-900 tracking-tight">
              Admin
            </span>
            <span className="font-sans text-stone-400 text-sm ml-2">Katka &amp; Šimon</span>
          </div>
          {authenticated && (
            <form action="/api/admin/logout" method="POST">
              <button
                type="submit"
                className="font-sans text-xs font-medium text-stone-500 hover:text-stone-800
                           tracking-[0.02em] transition-colors px-3 py-1.5 border border-stone-200
                           rounded-lg hover:border-stone-300"
              >
                Odhlásiť sa
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
        {authenticated ? <AdminPanel /> : <AdminLogin />}
      </div>
    </main>
  );
}

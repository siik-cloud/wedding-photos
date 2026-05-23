import { isAdminAuthenticated } from "@/lib/auth";
import AdminPanel from "@/components/AdminPanel";
import AdminLogin from "@/components/AdminLogin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authenticated = await isAdminAuthenticated();

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 py-4 px-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Admin panel</h1>
            <p className="text-sm text-gray-500">Svadba Katky a Šimona</p>
          </div>
          {authenticated && (
            <form action="/api/admin/logout" method="POST">
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-red-500 transition-colors px-3 py-1.5 border border-gray-200 rounded-lg"
              >
                Odhlásiť sa
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {authenticated ? <AdminPanel /> : <AdminLogin />}
      </div>
    </main>
  );
}

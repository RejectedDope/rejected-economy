import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await requireAdmin();

  if (!auth.ok) {
    if (auth.reason === "unconfigured") {
      return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-8">
          <div className="max-w-md rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-6">
            <p className="text-sm font-bold text-yellow-400">Dev mode</p>
            <p className="mt-1 text-xs text-zinc-500">
              Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and
              NEXT_PUBLIC_SUPABASE_ANON_KEY to access the admin panel.
            </p>
          </div>
        </div>
      );
    }
    redirect("/login");
  }

  return <>{children}</>;
}

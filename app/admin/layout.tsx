import { redirect } from "next/navigation";

const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://placeholder.supabase.co";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!supabaseConfigured) {
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

  // Dynamic import to avoid build-time crash when Supabase is unconfigured
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <>{children}</>;
}

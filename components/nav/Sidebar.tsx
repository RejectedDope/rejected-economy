"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  Zap,
  Package,
  Settings,
  LogOut,
  BarChart3,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analyzer", label: "Inventory Analyzer", icon: Upload },
  { href: "/recovery", label: "Recovery Center", icon: Zap },
  { href: "/inventory", label: "All Inventory", icon: Package },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-64 flex-col border-r border-zinc-800 bg-zinc-950">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-zinc-800 px-6">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-[#E935C1]">
            <BarChart3 className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-black uppercase tracking-widest text-zinc-100">
              Resale
            </span>
            <span className="text-sm font-black uppercase tracking-widest text-[#E935C1]">
              IQ
            </span>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-2 px-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
            Operations
          </span>
        </div>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-[#E935C1]/10 text-[#FF2D95] border border-[#E935C1]/20"
                      : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active ? "text-[#E935C1]" : "text-zinc-600 group-hover:text-zinc-400"
                    )}
                  />
                  {label}
                  {active && (
                    <ChevronRight className="ml-auto h-3 w-3 text-[#E935C1]" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Brand tagline */}
      <div className="border-t border-zinc-800 px-4 py-3">
        <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-zinc-700">
          by Rejected Economy
        </p>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-900 hover:text-zinc-300"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderUp,
  Zap,
  Package,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/inventory/import", label: "Import", icon: FolderUp, highlight: true },
  { href: "/recovery", label: "Recover", icon: Zap },
  { href: "/inventory", label: "Stock", icon: Package },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center border-t border-zinc-800 bg-zinc-950 lg:hidden">
      {NAV_ITEMS.map(({ href, label, icon: Icon, highlight }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium uppercase tracking-wide transition-colors",
              active
                ? "text-[#FF2D95]"
                : highlight
                ? "text-[#E935C1]"
                : "text-zinc-600 hover:text-zinc-400"
            )}
          >
            <Icon className={cn("h-5 w-5", highlight && !active && "text-[#E935C1]")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

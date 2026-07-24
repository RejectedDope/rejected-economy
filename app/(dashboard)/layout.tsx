export const dynamic = "force-dynamic";

import { Sidebar } from "@/components/nav/Sidebar";
import { MobileNav } from "@/components/nav/MobileNav";
import { ContextualCoachMarketActions } from "@/components/affiliate/ContextualCoachMarketActions";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Main content */}
      <main className="pb-20 lg:ml-64 lg:pb-0">
        {children}
        <ContextualCoachMarketActions />
      </main>

      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  );
}

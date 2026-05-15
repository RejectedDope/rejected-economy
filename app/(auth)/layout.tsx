import Link from "next/link";
import { BarChart3 } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded bg-[#E935C1]">
          <BarChart3 className="h-4 w-4 text-white" />
        </div>
        <span className="text-base font-black uppercase tracking-widest">
          <span className="text-zinc-100">Resale</span>
          <span className="text-[#E935C1]">IQ</span>
        </span>
      </Link>
      {children}
    </div>
  );
}

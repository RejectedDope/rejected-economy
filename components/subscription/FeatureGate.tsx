"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

type Props = {
  hasAccess: boolean;
  children: React.ReactNode;
  requiredTier?: string;
  label?: string;
};

export function FeatureGate({
  hasAccess,
  children,
  requiredTier = "Starter",
  label,
}: Props) {
  if (hasAccess) return <>{children}</>;

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="pointer-events-none select-none opacity-30 blur-[2px]">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-zinc-950/70 backdrop-blur-[1px]">
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5 text-center shadow-xl">
          <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-[#E935C1]/30 bg-[#E935C1]/10">
            <Lock className="h-4 w-4 text-[#E935C1]" />
          </div>
          <p className="text-sm font-bold text-zinc-100">
            {label ?? `${requiredTier}+ Feature`}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Upgrade to {requiredTier} to unlock this
          </p>
          <Link
            href="/settings/plan"
            className="mt-3 inline-block rounded-lg bg-[#E935C1] px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
          >
            View Plans →
          </Link>
        </div>
      </div>
    </div>
  );
}

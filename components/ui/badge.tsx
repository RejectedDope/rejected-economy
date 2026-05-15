import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider transition-colors",
  {
    variants: {
      variant: {
        default: "border-[#E935C1]/40 bg-[#E935C1]/10 text-[#FF2D95]",
        secondary: "border-zinc-700 bg-zinc-800 text-zinc-300",
        destructive: "border-red-600/40 bg-red-600/10 text-red-400",
        outline: "border-zinc-700 text-zinc-400",
        critical: "border-[#FF2D95]/50 bg-[#FF2D95]/10 text-[#FF2D95]",
        high: "border-orange-400/50 bg-orange-400/10 text-orange-400",
        medium: "border-yellow-400/50 bg-yellow-400/10 text-yellow-400",
        low: "border-emerald-400/50 bg-emerald-400/10 text-emerald-400",
        success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

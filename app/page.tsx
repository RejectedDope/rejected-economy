import Link from "next/link";
import {
  BarChart3,
  ArrowRight,
  Zap,
  Eye,
  TrendingDown,
  Package,
  CheckCircle,
  Clock,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const STATS = [
  { value: "73%", label: "of stale listings never sell after 90 days" },
  { value: "$4,200", label: "average trapped cash per active reseller" },
  { value: "6x", label: "higher sell-through after relisting + specifics" },
];

const FEATURES = [
  {
    icon: Eye,
    title: "Visibility Risk Scoring",
    body: "Every listing gets a decay score. Know which ones are invisible before the algorithm buries them forever.",
  },
  {
    icon: TrendingDown,
    title: "Aging Breakdown",
    body: "See exactly how much cash is trapped by listing age. 30-day buckets. No hiding from the numbers.",
  },
  {
    icon: Zap,
    title: "Recovery Action Center",
    body: "Relist, markdown, bundle, move platform — a prioritized action plan with reasoning, not just guesses.",
  },
  {
    icon: Package,
    title: "CSV Import",
    body: "Drop in your eBay export and get scored in seconds. No manual data entry. No fluff.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Upload Your Inventory",
    body: "Export from eBay Seller Hub and drop the CSV. We parse it, score every listing, and surface the problems immediately.",
  },
  {
    step: "02",
    title: "See What's Dead",
    body: "Every item gets a Dead Inventory Score and Visibility Risk rating based on listing age, specifics, photos, and title quality.",
  },
  {
    step: "03",
    title: "Execute the Plan",
    body: "The Recovery Center gives you a prioritized action list — what to relist, what to cut, what to bundle. Work the list. Move the cash.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-[#E935C1]">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-black uppercase tracking-widest">
              <span className="text-zinc-100">Resale</span>
              <span className="text-[#E935C1]">IQ</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-24 pt-24 sm:px-6">
        {/* Background texture */}
        <div className="pointer-events-none absolute inset-0 barcode-bg opacity-50" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[#E935C1]/5 blur-3xl" />

        <div className="relative mx-auto max-w-4xl text-center">
          {/* Pre-headline tag */}
          <div className="mb-6 inline-flex items-center gap-2 rounded border border-[#E935C1]/30 bg-[#E935C1]/5 px-3 py-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#E935C1]" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#E935C1]">
              For Serious Resellers
            </span>
          </div>

          <h1 className="text-balance text-5xl font-black leading-none tracking-tight text-white sm:text-6xl lg:text-7xl">
            Move Inventory.
            <br />
            <span className="text-[#E935C1]">Recover Profit.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
            Dead stock doesn&apos;t pay. ResaleIQ scores every listing in your
            inventory, surfaces the death pile, and hands you a tactical
            recovery plan to unlock trapped cash — fast.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/signup">
              <Button size="xl" className="w-full sm:w-auto">
                Get Free Inventory Recovery Audit
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" size="xl" className="w-full sm:w-auto">
                View Demo Dashboard
              </Button>
            </Link>
          </div>

          <p className="mt-4 text-xs text-zinc-700">
            No credit card required · Import eBay CSV in seconds
          </p>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-zinc-800 bg-zinc-900/50 px-4 py-8 sm:px-6">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
          {STATS.map(({ value, label }) => (
            <div key={value} className="text-center">
              <p className="text-3xl font-black text-[#E935C1]">{value}</p>
              <p className="mt-1 text-sm text-zinc-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-black text-zinc-100">
              Every Tool a Reseller Actually Needs
            </h2>
            <p className="mt-3 text-zinc-500">
              No bloat. No fluff. Just the tools that move inventory.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 transition-colors hover:border-zinc-700"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800">
                  <Icon className="h-5 w-5 text-[#E935C1]" />
                </div>
                <h3 className="text-sm font-bold text-zinc-100">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-zinc-800 bg-zinc-900/30 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-black text-zinc-100">
              From Death Pile to Sold
            </h2>
            <p className="mt-3 text-zinc-500">Three steps. No excuses.</p>
          </div>

          <div className="relative space-y-8">
            {HOW_IT_WORKS.map(({ step, title, body }, i) => (
              <div key={step} className="flex gap-6">
                <div className="flex flex-col items-center">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[#E935C1]/30 bg-[#E935C1]/10 font-mono text-sm font-bold text-[#E935C1]">
                    {step}
                  </div>
                  {i < HOW_IT_WORKS.length - 1 && (
                    <div className="mt-2 h-full w-px bg-zinc-800" />
                  )}
                </div>
                <div className="pb-8">
                  <h3 className="text-base font-bold text-zinc-100">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recovery preview */}
      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8">
            <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#E935C1]">
                  Recovery Center Preview
                </p>
                <h2 className="mt-3 text-2xl font-black text-zinc-100">
                  Stop Guessing. Start Working the Plan.
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                  The Recovery Action Center turns your inventory data into a
                  prioritized to-do list. Each action includes the reasoning
                  behind it — no black box, no guesswork. Just what to do next
                  and why.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    "Immediate vs. this-week vs. this-month urgency",
                    "Estimated cash recovery per action",
                    "Honest reasoning in reseller language",
                    "Direct links to each struggling listing",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#E935C1]" />
                      <span className="text-sm text-zinc-400">{item}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className="mt-8 block">
                  <Button>
                    Audit My Inventory Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>

              {/* Mini mockup */}
              <div className="space-y-3">
                {[
                  {
                    label: "Relist Now",
                    urgency: "IMMEDIATE",
                    count: 4,
                    cash: "$890",
                    color: "border-[#FF2D95]/30 bg-[#FF2D95]/5 text-[#FF2D95]",
                  },
                  {
                    label: "Fix Item Specifics",
                    urgency: "IMMEDIATE",
                    count: 7,
                    cash: "$1,240",
                    color: "border-[#FF2D95]/30 bg-[#FF2D95]/5 text-[#FF2D95]",
                  },
                  {
                    label: "Strategic Markdown",
                    urgency: "THIS WEEK",
                    count: 5,
                    cash: "$680",
                    color: "border-orange-400/30 bg-orange-400/5 text-orange-400",
                  },
                  {
                    label: "Liquidate",
                    urgency: "IMMEDIATE",
                    count: 3,
                    cash: "$210",
                    color: "border-[#FF2D95]/30 bg-[#FF2D95]/5 text-[#FF2D95]",
                  },
                ].map((action) => (
                  <div
                    key={action.label}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 ${action.color}`}
                  >
                    <div>
                      <p className="text-sm font-bold text-zinc-200">
                        {action.label}
                      </p>
                      <p className={`text-xs font-bold uppercase tracking-wide ${action.color.split(" ")[2]}`}>
                        {action.urgency} · {action.count} listings
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-bold text-emerald-400">
                      <DollarSign className="h-3.5 w-3.5" />
                      {action.cash}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-800 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-black text-zinc-100">
            Dead Stock Doesn&apos;t Pay.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-zinc-500">
            Every day your inventory sits is money locked up. ResaleIQ shows
            you exactly where it is and exactly what to do about it.
          </p>
          <Link href="/signup" className="mt-8 block">
            <Button size="xl" className="mx-auto">
              Get Your Free Recovery Audit
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <p className="mt-4 text-xs text-zinc-700">
            by Rejected Economy · Built for resellers, by resellers
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-[#E935C1]">
              <BarChart3 className="h-3 w-3 text-white" />
            </div>
            <span className="text-xs font-black uppercase tracking-widest">
              <span className="text-zinc-500">Resale</span>
              <span className="text-[#E935C1]">IQ</span>
            </span>
          </div>
          <p className="text-xs text-zinc-700">
            © {new Date().getFullYear()} Rejected Economy. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

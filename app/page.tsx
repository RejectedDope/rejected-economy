import Link from "next/link";
import {
  BarChart3,
  ArrowRight,
  Zap,
  Eye,
  TrendingDown,
  Package,
  CheckCircle,
  DollarSign,
  Clock,
  AlertTriangle,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const STATS = [
  { value: "73%", label: "of stale listings never sell after 90 days" },
  { value: "$4,200", label: "average trapped cash per active reseller" },
  { value: "6×", label: "higher sell-through after relisting + specifics" },
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
    title: "Submit the Audit Intake",
    body: "Tell ResaleIQ where you sell, how much inventory is sitting, and what problem is costing you the most cash right now.",
  },
  {
    step: "02",
    title: "Scan the Risk Signals",
    body: "We look at age risk, pricing position, visibility, title quality, item specifics, photo friction, and shipping friction.",
  },
  {
    step: "03",
    title: "Work the Recovery List",
    body: "The Recovery Center shows what to relist, rewrite, mark down, bundle, move, or liquidate. Work the list. Move the cash.",
  },
];

const WHO_ITS_FOR = [
  {
    icon: Package,
    title: "eBay Powersellers",
    body: "Thousands of listings, Cassini algorithm working against stale inventory. Know exactly what to relist vs. liquidate.",
  },
  {
    icon: Users,
    title: "Poshmark & Mercari Resellers",
    body: "Platform freshness cliffs at 7–14 days kill visibility fast. The scoring engine surfaces which items are dying.",
  },
  {
    icon: AlertTriangle,
    title: "Multi-Platform Flippers",
    body: "Items not selling on eBay might move instantly on Facebook Marketplace. Platform mismatch = avoidable dead stock.",
  },
  {
    icon: Clock,
    title: "Booth & Flea Market Sellers",
    body: "Slow-moving booth inventory costs you space rent every month. Spot what to price down, bundle, or pull.",
  },
];

const PAIN_POINTS = [
  {
    problem: "100+ views, zero sales",
    signal: "Price rejection signal",
    fix: "Strategic markdown",
    color: "text-orange-400",
    bg: "bg-orange-400/5 border-orange-400/20",
  },
  {
    problem: "Listed 6 months ago, buried",
    signal: "Cassini freshness cliff",
    fix: "Relist now",
    color: "text-[#FF2D95]",
    bg: "bg-[#FF2D95]/5 border-[#FF2D95]/20",
  },
  {
    problem: "Low-value items piling up",
    signal: "Sunk cost + space cost",
    fix: "Bundle or liquidate",
    color: "text-yellow-400",
    bg: "bg-yellow-400/5 border-yellow-400/20",
  },
  {
    problem: "Wrong platform, wrong buyer",
    signal: "Platform mismatch",
    fix: "Move platform",
    color: "text-emerald-400",
    bg: "bg-emerald-400/5 border-emerald-400/20",
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
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                Demo Dashboard
              </Button>
            </Link>
            <Link href="/recovery-audit">
              <Button size="sm">Get Free Audit</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-24 pt-24 sm:px-6">
        <div className="pointer-events-none absolute inset-0 barcode-bg opacity-50" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[#E935C1]/5 blur-3xl" />

        <div className="relative mx-auto max-w-4xl text-center">
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
            <Link href="/recovery-audit">
              <Button size="xl" className="w-full sm:w-auto">
                Get Free Recovery Audit
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
            No credit card required · No account required · Takes under 2 minutes
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

      {/* Pain points → signals → fixes */}
      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-black text-zinc-100">
              You Already Know Something Is Wrong
            </h2>
            <p className="mt-3 text-zinc-500">
              The signal is there. ResaleIQ translates it into a specific action.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {PAIN_POINTS.map(({ problem, signal, fix, color, bg }) => (
              <div
                key={problem}
                className={`flex items-start gap-4 rounded-lg border p-4 ${bg}`}
              >
                <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-zinc-200">{problem}</p>
                  <p className={`mt-0.5 text-xs ${color}`}>{signal}</p>
                  <p className="mt-1.5 text-xs text-zinc-500">
                    Fix:{" "}
                    <span className="font-semibold text-zinc-300">{fix}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-zinc-800 px-4 py-20 sm:px-6">
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

      {/* Who it's for */}
      <section className="border-t border-zinc-800 bg-zinc-900/30 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-black text-zinc-100">Who It&apos;s For</h2>
            <p className="mt-3 text-zinc-500">
              Built for resellers who move real inventory at real volume.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {WHO_ITS_FOR.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="flex gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-zinc-700"
              >
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded border border-zinc-700 bg-zinc-800">
                  <Icon className="h-4 w-4 text-[#E935C1]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">{title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-zinc-800 px-4 py-20 sm:px-6">
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

          <div className="mt-8 text-center">
            <Link href="/recovery-audit">
              <Button size="lg">
                Start Free Audit Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Recovery preview */}
      <section className="border-t border-zinc-800 bg-zinc-900/30 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8">
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
                <Link href="/recovery-audit" className="mt-8 block">
                  <Button>
                    Start Free Recovery Audit
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
                      <p
                        className={`text-xs font-bold uppercase tracking-wide ${action.color.split(" ")[2]}`}
                      >
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

      {/* Final CTA */}
      <section className="border-t border-zinc-800 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded border border-[#E935C1]/30 bg-[#E935C1]/5 px-3 py-1.5">
            <Clock className="h-3 w-3 text-[#E935C1]" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#E935C1]">
              Takes under 2 minutes
            </span>
          </div>
          <h2 className="text-4xl font-black text-zinc-100">
            Dead Stock Doesn&apos;t Pay.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-zinc-500">
            Every day your inventory sits is money locked up. ResaleIQ shows
            you exactly where it is and exactly what to do about it.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/recovery-audit">
              <Button size="xl" className="w-full sm:w-auto">
                Get Your Free Recovery Audit
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

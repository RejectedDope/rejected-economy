"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  BarChart3,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  TrendingDown,
  ScanLine,
  DollarSign,
  ImageIcon,
  Tag,
  Package,
  Truck,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { Label } from "@/components/ui/label";

// ─── Types ────────────────────────────────────────────────────────────────────

type AuditFormData = {
  name: string;
  email: string;
  platform: string;
  inventory_count: string;
  biggest_problem: string;
  listing_url: string;
  notes: string;
};

type FormErrors = Partial<Record<keyof AuditFormData, string>>;

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS = [
  "eBay",
  "Poshmark",
  "Mercari",
  "Facebook Marketplace",
  "Depop",
  "Vinted",
  "Whatnot",
  "Antique booth / flea market",
  "Multiple platforms",
];

const INVENTORY_COUNTS = [
  "Under 25 items",
  "25–100 items",
  "100–500 items",
  "500–1,000 items",
  "Over 1,000 items",
];

const PROBLEMS = [
  "Items sitting too long",
  "Not sure how to price",
  "Listings getting views but no sales",
  "Too much inventory",
  "Need to know what to relist or liquidate",
  "Not sure which platform is best",
  "Other",
];

const AUDIT_SIGNALS = [
  {
    icon: AlertTriangle,
    label: "Dead-stock risk",
    desc: "How long each item has been sitting and where it sits on the decay curve.",
    color: "text-[#FF2D95]",
    bg: "bg-[#FF2D95]/10 border-[#FF2D95]/20",
  },
  {
    icon: DollarSign,
    label: "Pricing position",
    desc: "Views without watchers = price rejection. We surface the signal before you lose more time.",
    color: "text-orange-400",
    bg: "bg-orange-400/10 border-orange-400/20",
  },
  {
    icon: ScanLine,
    label: "Weak title signals",
    desc: "Missing keywords mean zero impressions no matter how good the item is.",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10 border-yellow-400/20",
  },
  {
    icon: Tag,
    label: "Missing item specifics",
    desc: "Incomplete specifics make listings invisible in filtered searches. Fastest free fix.",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/20",
  },
  {
    icon: ImageIcon,
    label: "Photo friction",
    desc: "Single-photo listings convert ~40% worse than 4+ photo listings. We flag them.",
    color: "text-blue-400",
    bg: "bg-blue-400/10 border-blue-400/20",
  },
  {
    icon: Truck,
    label: "Shipping friction",
    desc: "High shipping cost relative to price kills conversions on low-value inventory.",
    color: "text-zinc-400",
    bg: "bg-zinc-700/30 border-zinc-700",
  },
  {
    icon: TrendingDown,
    label: "Best recovery action",
    desc: "Relist, markdown, bundle, or liquidate — ranked by highest cash recovery for your situation.",
    color: "text-[#E935C1]",
    bg: "bg-[#E935C1]/10 border-[#E935C1]/20",
  },
];

// ─── Styling helpers ──────────────────────────────────────────────────────────

const selectClass =
  "flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#E935C1] focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer";

const textareaClass =
  "flex min-h-[88px] w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#E935C1] focus:ring-offset-2 focus:ring-offset-zinc-950 resize-none";

const fieldErrorClass = "mt-1 text-xs text-red-400";

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(data: AuditFormData): FormErrors {
  const errors: FormErrors = {};
  if (!data.name.trim()) errors.name = "Name is required";
  if (!data.email.trim()) errors.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
    errors.email = "Enter a valid email address";
  if (!data.platform) errors.platform = "Select your primary platform";
  if (!data.inventory_count) errors.inventory_count = "Select your approximate inventory size";
  if (!data.biggest_problem) errors.biggest_problem = "Select your biggest current problem";
  return errors;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RecoveryAuditPage() {
  const formRef = useRef<HTMLDivElement>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  // Detect whether Supabase is pointed at a real project.
  // NEXT_PUBLIC_ vars are inlined at build time — safe to read here.
  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://placeholder.supabase.co";
  const [form, setForm] = useState<AuditFormData>({
    name: "",
    email: "",
    platform: "",
    inventory_count: "",
    biggest_problem: "",
    listing_url: "",
    notes: "",
  });

  function set(field: keyof AuditFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    if (!supabaseConfigured) {
      // Dev/demo mode: Supabase not wired up yet. Skip the insert and
      // show a warning instead of faking success or throwing a network error.
      setSubmitting(false);
      setSubmitError(
        "⚙️ Dev mode: Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable lead capture. Run supabase/migrations/002_audit_leads.sql first."
      );
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.from("audit_leads").insert({
        name:             form.name.trim(),
        email:            form.email.trim().toLowerCase(),
        primary_platform: form.platform,
        inventory_count:  form.inventory_count,
        biggest_problem:  form.biggest_problem,
        listing_url:      form.listing_url.trim() || null,
        notes:            form.notes.trim() || null,
      });

      if (error) throw error;

      setSubmitted(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setSubmitError(
        `Couldn't save your audit request. Please try again. (${message})`
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950">

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-[#E935C1]">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-black uppercase tracking-widest">
              <span className="text-zinc-100">Resale</span>
              <span className="text-[#E935C1]">IQ</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                Demo Dashboard
              </Button>
            </Link>
            <Link href="/login">
              <Button size="sm">Sign In</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 pb-16 pt-20 sm:px-6 sm:pt-24">
        <div className="pointer-events-none absolute inset-0 barcode-bg opacity-40" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-[#E935C1]/5 blur-3xl" />

        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded border border-[#E935C1]/30 bg-[#E935C1]/5 px-3 py-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#E935C1]" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#E935C1]">
              Free Recovery Audit
            </span>
          </div>

          <h1 className="text-balance text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Find the cash trapped in
            <br />
            <span className="text-[#E935C1]">your dead inventory.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            ResaleIQ scans listing signals, pricing position, stale inventory
            risk, and marketplace friction to show you what to fix first — and
            how much cash you can recover.
          </p>

          <div className="mt-8">
            <Button size="xl" onClick={scrollToForm} className="w-full sm:w-auto">
              Start Free Recovery Audit
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          <p className="mt-3 text-xs text-zinc-700">
            No credit card · No account required · Takes under 2 minutes
          </p>
        </div>
      </section>

      {/* ── Main content: form + promise ──────────────────────────────────── */}
      <section className="px-4 pb-24 pt-8 sm:px-6" ref={formRef}>
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 lg:grid-cols-5 lg:gap-12 lg:items-start">

            {/* ── Left: Form or Confirmation ────────────────────────────── */}
            <div className="lg:col-span-3">
              {submitted ? (
                /* ── Confirmation panel ─────────────────────────────────── */
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-8">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
                    <CheckCircle className="h-6 w-6 text-emerald-400" />
                  </div>
                  <h2 className="text-xl font-black text-zinc-100">
                    Audit request saved.
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    Your audit is queued. Next step: scan your highest-risk item
                    first. Use the analyzer to enter a single listing and get an
                    instant recovery recommendation.
                  </p>

                  <div className="mt-6 space-y-3">
                    <Link href="/analyzer" className="block">
                      <Button className="w-full">
                        <ScanLine className="mr-2 h-4 w-4" />
                        Scan My Highest-Risk Item Now
                      </Button>
                    </Link>
                    <Link href="/dashboard" className="block">
                      <Button variant="outline" className="w-full">
                        View Demo Dashboard
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>

                  <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">
                      While you wait
                    </p>
                    <ul className="mt-3 space-y-2">
                      {[
                        "Check any listing with 100+ views and 0 watchers — that's a price rejection signal",
                        "Count listings over 90 days old — those are past the Cassini freshness cliff",
                        "Any item under $15 that's been sitting 6+ months belongs in a bundle, not solo",
                      ].map((tip) => (
                        <li key={tip} className="flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#E935C1]" />
                          <span className="text-xs leading-relaxed text-zinc-500">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                /* ── Intake form ────────────────────────────────────────── */
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8">
                  <div className="mb-6">
                    <h2 className="text-lg font-black text-zinc-100">
                      Audit Intake
                    </h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      Tell us about your inventory. We&apos;ll build your recovery
                      priority list from here.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} noValidate className="space-y-5">

                    {/* Name + Email */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          placeholder="Your name"
                          value={form.name}
                          onChange={(e) => set("name", e.target.value)}
                        />
                        {errors.name && <p className={fieldErrorClass}>{errors.name}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                          value={form.email}
                          onChange={(e) => set("email", e.target.value)}
                        />
                        {errors.email && <p className={fieldErrorClass}>{errors.email}</p>}
                      </div>
                    </div>

                    {/* Primary platform */}
                    <div className="space-y-1.5">
                      <Label htmlFor="platform">Primary Selling Platform</Label>
                      <div className="relative">
                        <select
                          id="platform"
                          className={selectClass}
                          value={form.platform}
                          onChange={(e) => set("platform", e.target.value)}
                        >
                          <option value="" disabled>Select your main platform…</option>
                          {PLATFORMS.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                          <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                      {errors.platform && <p className={fieldErrorClass}>{errors.platform}</p>}
                    </div>

                    {/* Inventory count */}
                    <div className="space-y-1.5">
                      <Label htmlFor="inventory_count">Approximate Inventory Count</Label>
                      <div className="relative">
                        <select
                          id="inventory_count"
                          className={selectClass}
                          value={form.inventory_count}
                          onChange={(e) => set("inventory_count", e.target.value)}
                        >
                          <option value="" disabled>How many active listings?</option>
                          {INVENTORY_COUNTS.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                          <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                      {errors.inventory_count && (
                        <p className={fieldErrorClass}>{errors.inventory_count}</p>
                      )}
                    </div>

                    {/* Biggest problem */}
                    <div className="space-y-1.5">
                      <Label htmlFor="biggest_problem">Biggest Current Problem</Label>
                      <div className="relative">
                        <select
                          id="biggest_problem"
                          className={selectClass}
                          value={form.biggest_problem}
                          onChange={(e) => set("biggest_problem", e.target.value)}
                        >
                          <option value="" disabled>What&apos;s the main issue?</option>
                          {PROBLEMS.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                          <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                      {errors.biggest_problem && (
                        <p className={fieldErrorClass}>{errors.biggest_problem}</p>
                      )}
                    </div>

                    {/* Optional listing URL */}
                    <div className="space-y-1.5">
                      <Label htmlFor="listing_url">
                        Listing URL{" "}
                        <span className="font-normal text-zinc-600">(optional)</span>
                      </Label>
                      <Input
                        id="listing_url"
                        type="url"
                        placeholder="eBay, Poshmark, Mercari listing link…"
                        value={form.listing_url}
                        onChange={(e) => set("listing_url", e.target.value)}
                      />
                      <p className="text-[11px] text-zinc-700">
                        Share a specific listing you want us to look at first.
                      </p>
                    </div>

                    {/* Optional notes */}
                    <div className="space-y-1.5">
                      <Label htmlFor="notes">
                        Notes{" "}
                        <span className="font-normal text-zinc-600">(optional)</span>
                      </Label>
                      <textarea
                        id="notes"
                        className={textareaClass}
                        placeholder="Anything else we should know — categories you sell, items you're stuck on, goals…"
                        value={form.notes}
                        onChange={(e) => set("notes", e.target.value)}
                        rows={3}
                      />
                    </div>

                    {submitError && (
                      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
                        <p className="text-xs leading-relaxed text-red-400">{submitError}</p>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      size="lg"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting…
                        </>
                      ) : (
                        <>
                          Submit Audit Request
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>

                    <p className="text-center text-xs text-zinc-700">
                      No account needed. No credit card. No spam.
                    </p>
                  </form>
                </div>
              )}
            </div>

            {/* ── Right: Audit promise / signal list ────────────────────── */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">
                  What the Audit Looks For
                </p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Seven signals that separate dead inventory from recoverable
                  cash. Each one maps to a specific fix.
                </p>

                <div className="mt-5 space-y-3">
                  {AUDIT_SIGNALS.map(({ icon: Icon, label, desc, color, bg }) => (
                    <div
                      key={label}
                      className={`flex gap-3 rounded-lg border p-3 ${bg}`}
                    >
                      <div className={`mt-0.5 shrink-0 ${color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${color}`}>{label}</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Social proof / urgency strip */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="space-y-3">
                  {[
                    { stat: "73%", label: "of stale listings never sell after 90 days" },
                    { stat: "$4,200", label: "average trapped cash per active reseller" },
                    { stat: "6×", label: "higher sell-through after relist + specifics" },
                  ].map(({ stat, label }) => (
                    <div key={stat} className="flex items-baseline gap-2">
                      <span className="text-lg font-black text-[#E935C1]">{stat}</span>
                      <span className="text-xs text-zinc-600">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
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

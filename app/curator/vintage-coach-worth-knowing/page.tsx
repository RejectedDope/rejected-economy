import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EbayAffiliateActions } from "@/components/affiliate/EbayAffiliateActions";
import { epnPlacements } from "@/lib/affiliate/epn";

export default function VintageCoachWorthKnowingPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-12 text-zinc-100 sm:px-6">
      <article className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to ResaleIQ
        </Link>

        <header className="mt-10 border-b border-zinc-800 pb-10">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#E935C1]">
            Rejected Curator
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Vintage Coach Worth Knowing
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-zinc-400">
            The point is not to treat every old Coach bag like a jackpot. The market
            separates common vintage pieces from harder-to-find Y2K styles and much
            earlier collector pieces. Era, construction, hardware, leather, color,
            condition, and provenance all matter.
          </p>
        </header>

        <div className="space-y-10 py-10 text-zinc-300">
          <section>
            <h2 className="text-2xl font-black text-white">Everyday vintage</h2>
            <p className="mt-3 leading-7 text-zinc-400">
              Many 1980s and 1990s leather Coach bags remain relatively common. They can
              still be desirable, but age alone does not make a piece rare. Strong
              condition, useful silhouettes, appealing colors, and clear identifying
              details are what separate better examples from ordinary inventory.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white">Y2K-era demand</h2>
            <p className="mt-3 leading-7 text-zinc-400">
              Smaller shoulder bags, hobos, buckle details, and recognizable early-2000s
              silhouettes can attract a different buyer than classic vintage leather.
              Do not price from one ambitious listing. Compare active competition and
              completed sales before deciding where a specific piece sits in the market.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white">Earlier collector pieces</h2>
            <p className="mt-3 leading-7 text-zinc-400">
              Earlier all-leather designs, unusual construction, distinctive hardware,
              uncommon colors, and historically significant design details deserve deeper
              research. This is where accurate identification matters most. A similar-looking
              bag is not automatically the same era, model, or value tier.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-white">What to inspect first</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                "Country and manufacturing markings",
                "Creed and serial details where present",
                "Original hardware and turnlock details",
                "Leather type, color, and condition",
                "Silhouette and era-specific construction",
                "Repairs, alterations, and replacement parts",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>
        </div>

        <EbayAffiliateActions
          title="See What the Market Looks Like Now"
          placements={[epnPlacements.curatorCoachGuide]}
        />

        <p className="mt-8 text-xs leading-relaxed text-zinc-600">
          Market listings change constantly. Current listings are not the same as confirmed
          sale prices and should be used as one research input, not a guaranteed valuation.
        </p>
      </article>
    </main>
  );
}

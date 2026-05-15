import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ResaleIQ — Dead Stock Doesn't Pay",
  description:
    "Move inventory. Recover profit. ResaleIQ surfaces buried listings, scores your death pile, and gives you a tactical plan to unlock trapped cash.",
  keywords: ["resale", "inventory management", "eBay", "sell-through", "dead stock"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-zinc-950 text-zinc-100 antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}

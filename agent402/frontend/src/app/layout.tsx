import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent402 — Pay-Per-Use Trust Oracle for AI Agents",
  description:
    "Transparent reputation infrastructure for AI agents. Trust evaluations via x402 USDC micropayments on Base.",
  openGraph: {
    title: "Agent402 — Pay-Per-Use Trust Oracle",
    description:
      "Trust evaluations for AI agents via x402 USDC micropayments. $0.01 per query.",
    url: "https://agent402.sh",
    siteName: "Agent402",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Agent402 — Pay-Per-Use Trust Oracle",
    description:
      "Trust evaluations for AI agents via x402 USDC micropayments. $0.01 per query.",
  },
};

function Header() {
  return (
    <header className="border-b border-surface-2 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-white font-bold text-sm">
            4
          </div>
          <span className="font-sans font-semibold text-white tracking-tight">
            Agent402
          </span>
        </a>
        <nav className="flex items-center gap-6 text-sm font-mono">
          <a href="/leaderboard" className="text-muted hover:text-white transition-colors">
            Leaderboard
          </a>
          <a href="/lookup" className="text-muted hover:text-white transition-colors">
            Lookup
          </a>
          <a href="/docs" className="text-muted hover:text-white transition-colors">
            Docs
          </a>
          <a
            href="/docs#pricing"
            className="bg-primary/10 text-primary border border-primary/30 px-3 py-1 rounded-md hover:bg-primary/20 transition-colors"
          >
            $0.01/call
          </a>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-surface-2 mt-20">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
            4
          </div>
          <span>Agent402</span>
        </div>
        <div className="flex gap-6 font-mono text-xs">
          <a href="https://www.x402.org/" className="hover:text-muted transition-colors">
            x402 Protocol
          </a>
          <a href="/.well-known/agent.json" className="hover:text-muted transition-colors">
            A2A Card
          </a>
          <a href="/api/v1/pricing" className="hover:text-muted transition-colors">
            API Pricing
          </a>
          <a href="https://agentproof.sh" className="hover:text-muted transition-colors">
            AgentProof
          </a>
        </div>
        <div className="text-muted-3 text-xs">
          USDC on Base &middot; x402 Micropayments
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-mono antialiased min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

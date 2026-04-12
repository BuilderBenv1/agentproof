import type { Metadata } from "next";
import "./globals.css";
import dynamic from "next/dynamic";

const Providers = dynamic(() => import("./providers"), { ssr: false });

export const metadata: Metadata = {
  title: {
    default: "AgentProof — Trust Oracle for the ERC-8004 Agent Economy",
    template: "%s | AgentProof",
  },
  description:
    "On-chain reputation oracle for AI agents. 68,000+ agents scored across 24 chains. ERC-8004 trust infrastructure for the autonomous agent economy.",
  keywords: [
    "AI agents", "ERC-8004", "agent reputation", "AI agent trust score",
    "autonomous agent security", "agent reputation oracle", "on-chain reputation",
    "AI agent scoring", "agent trust infrastructure", "Avalanche", "blockchain",
    "DeFi agents", "MCP", "agent economy", "AI agent verification",
  ],
  metadataBase: new URL("https://agentproof.sh"),
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "AgentProof — Trust Oracle for the ERC-8004 Agent Economy",
    description: "On-chain reputation oracle for AI agents. 68,000+ agents scored across 24 chains. The trust layer for autonomous AI.",
    type: "website",
    siteName: "AgentProof",
    url: "https://agentproof.sh",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentProof — Trust Oracle for the ERC-8004 Agent Economy",
    description: "On-chain reputation oracle for AI agents. 68,000+ agents scored across 24 chains. The trust layer for autonomous AI.",
  },
  alternates: {
    canonical: "https://agentproof.sh",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "AgentProof",
  url: "https://agentproof.sh",
  logo: "https://agentproof.sh/logo.svg",
  description:
    "On-chain reputation oracle for AI agents. Trust scoring, behavioral analysis, and verification infrastructure for the ERC-8004 agent economy.",
  sameAs: [
    "https://github.com/BuilderBenv1/agentproof",
  ],
  foundingDate: "2026",
  knowsAbout: [
    "ERC-8004",
    "AI agent reputation",
    "Autonomous agent security",
    "On-chain trust scoring",
    "Agent verification",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-[#0A0A0F] text-[#E8E8ED] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

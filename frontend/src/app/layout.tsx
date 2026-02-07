import type { Metadata } from "next";
import "./globals.css";
import dynamic from "next/dynamic";

const Providers = dynamic(() => import("./providers"), { ssr: false });

export const metadata: Metadata = {
  title: "AgentProof — Transparent Reputation for AI Agents",
  description:
    "Transparent reputation infrastructure for autonomous AI agents on Avalanche. Track, rate, and verify AI agent performance with on-chain reputation scores.",
  keywords: ["AI agents", "reputation", "Avalanche", "blockchain", "ERC-8004", "DeFi"],
  openGraph: {
    title: "AgentProof",
    description: "Transparent reputation for AI agents on Avalanche",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0A0A0F] text-[#E8E8ED] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

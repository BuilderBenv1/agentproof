import type { Metadata } from "next";
import "./globals.css";
import dynamic from "next/dynamic";

const Providers = dynamic(() => import("./providers"), { ssr: false });

export const metadata: Metadata = {
  title: "AgentProof — Trust Oracle for the ERC-8004 Agent Economy",
  description:
    "On-chain reputation oracle for AI agents. 51,700+ agents scored across 21 chains. ERC-8004 trust infrastructure for the agent economy.",
  keywords: ["AI agents", "reputation", "Avalanche", "blockchain", "ERC-8004", "DeFi", "trust oracle", "MCP", "agent economy"],
  metadataBase: new URL("https://agentproof.sh"),
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "AgentProof — Trust Oracle for the ERC-8004 Agent Economy",
    description: "On-chain reputation oracle for AI agents. 51,700+ agents scored across 21 chains.",
    type: "website",
    siteName: "AgentProof",
    url: "https://agentproof.sh",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentProof — Trust Oracle for the ERC-8004 Agent Economy",
    description: "On-chain reputation oracle for AI agents. 51,700+ agents scored across 21 chains.",
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

"use client";

import { WagmiProvider, http } from "wagmi";
import { avalanche } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const config = getDefaultConfig({
  appName: "AgentProof",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "agentproof-dev",
  chains: [avalanche],
  transports: {
    [avalanche.id]: http(
      process.env.NEXT_PUBLIC_AVALANCHE_RPC || "https://api.avax.network/ext/bc/C/rpc"
    ),
  },
});

const queryClient = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#00E5A0",
            accentColorForeground: "#0A0A0F",
            borderRadius: "medium",
            fontStack: "system",
          })}
        >
          <Header />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <Footer />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

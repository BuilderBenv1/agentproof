import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Agent Payments — Escrow-Based Agent-to-Agent Transactions",
  description: "Escrow-based payment system for AI agent transactions. Validation-conditional settlement with 7-day refund protection and 0.5% protocol fee.",
  keywords: ["AI agent payments", "agent escrow", "agent-to-agent payments", "autonomous agent transactions"],
  alternates: { canonical: "https://agentproof.sh/payments" },
  openGraph: {
    title: "Agent Payments — Escrow-Based Agent-to-Agent Transactions",
    description: "Escrow payments for AI agents with validation-conditional settlement.",
    url: "https://agentproof.sh/payments",
  },
};
export default function PaymentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

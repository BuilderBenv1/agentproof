"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, ArrowLeft, ExternalLink } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import { intelligenceFetch } from "@/lib/intelligence";
import { timeAgo } from "@/lib/utils";

interface WhaleTx {
  id: number;
  wallet_address: string;
  token_symbol: string;
  action: string;
  amount_usd: number;
  significance: string;
  analysis: string;
  detected_at: string;
  tx_hash: string | null;
}

function sigColor(sig: string) {
  if (sig === "critical") return "text-red-400 bg-red-500/10";
  if (sig === "high") return "text-orange-400 bg-orange-500/10";
  if (sig === "medium") return "text-yellow-400 bg-yellow-500/10";
  return "text-gray-400 bg-gray-500/10";
}

function formatUSD(n: number) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function truncAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "—";
}

export default function WhalePage() {
  const [transactions, setTransactions] = useState<WhaleTx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const txs = await intelligenceFetch<WhaleTx[]>("/api/v1/whale/transactions", {
          params: { limit: 50 },
        });
        setTransactions(txs);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const criticalCount = transactions.filter((t) => t.significance === "critical" || t.significance === "high").length;
  const totalVolume = transactions.reduce((s, t) => s + (t.amount_usd || 0), 0);
  const tokens = new Set(transactions.map((t) => t.token_symbol)).size;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/intelligence" className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Eye className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Whale Tracker</h1>
            <p className="text-xs text-gray-500 font-mono">Monitoring top Avalanche wallets for significant moves</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Transactions" value={transactions.length} sublabel="recent" />
        <StatCard label="High Significance" value={criticalCount} sublabel="critical + high" />
        <StatCard label="Volume" value={formatUSD(totalVolume)} sublabel="total tracked" />
        <StatCard label="Tokens" value={tokens} sublabel="unique tokens" />
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-600 font-mono text-sm">Loading whale data...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 bg-gray-900/30 border border-gray-800 rounded-xl">
            <Eye className="w-8 h-8 text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500 font-mono text-sm">No whale transactions yet</p>
          </div>
        ) : (
          transactions.map((tx) => (
            <div
              key={tx.id}
              className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold uppercase ${sigColor(tx.significance)}`}>
                    {tx.significance}
                  </span>
                  <span className="text-white font-bold font-mono">{tx.token_symbol}</span>
                  <span className="text-xs text-gray-500 font-mono uppercase">{tx.action}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-emerald-400 font-bold">{formatUSD(tx.amount_usd)}</span>
                  <span className="text-xs text-gray-600 font-mono">{timeAgo(tx.detected_at)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 line-clamp-1 flex-1 mr-4">
                  {tx.analysis || "Pending analysis..."}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono text-gray-600">{truncAddr(tx.wallet_address)}</span>
                  {tx.tx_hash && (
                    <a
                      href={`https://snowscan.xyz/tx/${tx.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:text-cyan-400 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

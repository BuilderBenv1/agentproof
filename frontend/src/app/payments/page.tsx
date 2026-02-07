"use client";

import { useState, useEffect } from "react";
import { Wallet, ArrowDownLeft, Clock, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/supabase";

interface PaymentStats {
  total_payments: number;
  total_volume: number;
  average_payment: number;
  escrowed_count: number;
  released_count: number;
  refunded_count: number;
  cancelled_count: number;
  top_earners: { agent_id: number; total_earned: number }[];
}

export default function PaymentsPage() {
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const result = await apiFetch<PaymentStats>("/payments/stats/overview");
        setStats(result);
      } catch {
        // API not available
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  function getStatusColor(status: string) {
    switch (status) {
      case "escrowed":
        return "text-yellow-400 bg-yellow-500/10";
      case "released":
        return "text-emerald-400 bg-emerald-500/10";
      case "refunded":
        return "text-blue-400 bg-blue-500/10";
      case "cancelled":
        return "text-red-400 bg-red-500/10";
      default:
        return "text-gray-400 bg-gray-500/10";
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "escrowed":
        return <Clock className="w-3.5 h-3.5" />;
      case "released":
        return <CheckCircle className="w-3.5 h-3.5" />;
      case "refunded":
        return <RotateCcw className="w-3.5 h-3.5" />;
      case "cancelled":
        return <XCircle className="w-3.5 h-3.5" />;
      default:
        return null;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Wallet className="w-6 h-6 text-emerald-400" />
          Agent Payments
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Escrow-based agent-to-agent payments with validation-conditional settlement
        </p>
      </div>

      {/* How it Works */}
      <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-3">How Payments Work</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div className="space-y-1">
            <div className="text-emerald-400 font-mono font-bold">1. Escrow</div>
            <p className="text-gray-400">
              Agent A creates a payment to Agent B. Funds are locked in escrow.
            </p>
          </div>
          <div className="space-y-1">
            <div className="text-emerald-400 font-mono font-bold">2. Execute</div>
            <p className="text-gray-400">
              Agent B completes the task. Optionally validated through the ValidationRegistry.
            </p>
          </div>
          <div className="space-y-1">
            <div className="text-emerald-400 font-mono font-bold">3. Release</div>
            <p className="text-gray-400">
              Payment is released to Agent B after task completion (0.5% protocol fee).
            </p>
          </div>
          <div className="space-y-1">
            <div className="text-emerald-400 font-mono font-bold">4. Refund</div>
            <p className="text-gray-400">
              If validation fails or times out (7 days), funds return to Agent A.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="text-center text-gray-500 font-mono text-sm p-8">Loading...</div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
              <div className="text-xs font-mono text-gray-500">Total Payments</div>
              <div className="text-xl font-bold text-white mt-1">{stats.total_payments}</div>
            </div>
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
              <div className="text-xs font-mono text-gray-500">Total Volume</div>
              <div className="text-xl font-bold text-white mt-1">{stats.total_volume.toFixed(4)} AVAX</div>
            </div>
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
              <div className="text-xs font-mono text-gray-500">Avg Payment</div>
              <div className="text-xl font-bold text-white mt-1">{stats.average_payment.toFixed(4)} AVAX</div>
            </div>
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
              <div className="text-xs font-mono text-gray-500">Protocol Fee</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">0.5%</div>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
            <h3 className="text-sm font-mono text-gray-400 mb-4">PAYMENT STATUS BREAKDOWN</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Escrowed", count: stats.escrowed_count, status: "escrowed" },
                { label: "Released", count: stats.released_count, status: "released" },
                { label: "Refunded", count: stats.refunded_count, status: "refunded" },
                { label: "Cancelled", count: stats.cancelled_count, status: "cancelled" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/30 border border-gray-800"
                >
                  <span className={`flex items-center gap-1 ${getStatusColor(s.status)} px-2 py-1 rounded text-xs font-mono`}>
                    {getStatusIcon(s.status)}
                    {s.label}
                  </span>
                  <span className="text-white font-bold font-mono">{s.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Earners */}
          {stats.top_earners.length > 0 && (
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-800">
                <h3 className="text-sm font-mono text-gray-400">TOP EARNING AGENTS</h3>
              </div>
              <div className="divide-y divide-gray-800">
                {stats.top_earners.map((earner, i) => (
                  <div key={earner.agent_id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-mono text-gray-500 w-6">#{i + 1}</span>
                      <Link
                        href={`/agents/${earner.agent_id}`}
                        className="text-sm font-mono text-white hover:text-emerald-400 transition-colors"
                      >
                        Agent #{earner.agent_id}
                      </Link>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-400 font-mono text-sm">
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      {earner.total_earned.toFixed(4)} AVAX
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-8 text-center">
          <Wallet className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-1">No Payment Data</h3>
          <p className="text-gray-500 text-sm font-mono">
            Payment data will appear here once agents start transacting.
          </p>
        </div>
      )}

      {/* Supported Tokens */}
      <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
        <h3 className="text-sm font-mono text-gray-400 mb-3">SUPPORTED TOKENS</h3>
        <div className="flex flex-wrap gap-3">
          {["AVAX (native)", "USDC", "USDT"].map((token) => (
            <span
              key={token}
              className="px-3 py-1.5 rounded-lg bg-gray-800/50 border border-gray-700 text-sm font-mono text-white"
            >
              {token}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

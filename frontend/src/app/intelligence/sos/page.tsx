"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import StatCard from "@/components/ui/StatCard";
import DateRangeFilter from "@/components/ui/DateRangeFilter";
import { intelligenceFetch } from "@/lib/intelligence";
import { timeAgo } from "@/lib/utils";

interface SOSConfig {
  id: number;
  wallet_address: string;
  tokens_to_protect: string[];
  crash_threshold_pct: number;
  protocol_tvl_threshold_pct: number;
  health_factor_threshold: number;
  exit_to_token: string;
  is_active: boolean;
  triggers_fired: number;
  total_value_saved_usd: number;
  created_at: string;
}

interface SOSEvent {
  id: number;
  config_id: number;
  trigger_type: string;
  trigger_details: Record<string, unknown>;
  tokens_exited: Record<string, unknown>;
  total_value_saved_usd: number;
  exit_tx_hashes: string[];
  triggered_at: string;
}

interface SOSHealth {
  active_configs: number;
  events_triggered: number;
  total_value_saved_usd: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono">
      <p className="text-white font-bold">{d.name || d.trigger_type}</p>
      {d.total_value_saved_usd !== undefined && <p className="text-emerald-400">Saved: ${d.total_value_saved_usd.toFixed(2)}</p>}
      {d.value !== undefined && <p className="text-gray-400">{d.value}</p>}
    </div>
  );
};

const TRIGGER_COLORS: Record<string, string> = {
  crash: "#ef4444",
  hack: "#f59e0b",
  health: "#3b82f6",
  volatility: "#8b5cf6",
};
const PIE_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6"];

export default function SOSPage() {
  const [configs, setConfigs] = useState<SOSConfig[]>([]);
  const [events, setEvents] = useState<SOSEvent[]>([]);
  const [health, setHealth] = useState<SOSHealth | null>(null);
  const [since, setSince] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params: Record<string, string | number> = { limit: 50 };
        if (since) params.since = since;
        const [h, c, e] = await Promise.all([
          intelligenceFetch<SOSHealth>("/api/v1/sos/health"),
          intelligenceFetch<SOSConfig[]>("/api/v1/sos/configs"),
          intelligenceFetch<SOSEvent[]>("/api/v1/sos/events", { params }),
        ]);
        setHealth(h);
        setConfigs(c);
        setEvents(e);
      } catch {}
      setLoading(false);
    }
    load();
  }, [since]);

  const totalSaved = health?.total_value_saved_usd ?? configs.reduce((s, c) => s + (c.total_value_saved_usd || 0), 0);
  const activeConfigs = configs.filter((c) => c.is_active).length;
  const totalTriggers = events.length;

  // Value saved per config chart
  const savedChartData = configs
    .filter((c) => c.total_value_saved_usd > 0)
    .map((c) => ({
      name: c.wallet_address.slice(0, 6) + "..." + c.wallet_address.slice(-4),
      total_value_saved_usd: c.total_value_saved_usd || 0,
      triggers_fired: c.triggers_fired || 0,
    }));

  // Trigger type distribution
  const triggerCounts: Record<string, number> = {};
  events.forEach((e) => {
    triggerCounts[e.trigger_type] = (triggerCounts[e.trigger_type] || 0) + 1;
  });
  const triggerPieData = Object.entries(triggerCounts).map(([type, count]) => ({
    name: type.charAt(0).toUpperCase() + type.slice(1),
    value: count,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/intelligence" className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">SOS Emergency</h1>
            <p className="text-xs text-gray-500 font-mono">Automated crash protection on Avalanche</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <DateRangeFilter value={since} onChange={setSince} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Shields" value={health?.active_configs ?? activeConfigs} sublabel="protection configs" />
        <StatCard label="Value Saved" value={`$${totalSaved.toFixed(0)}`} sublabel="from emergency exits" />
        <StatCard label="Triggers Fired" value={health?.events_triggered ?? totalTriggers} sublabel="emergency events" />
        <StatCard label="Avg Saved/Event" value={totalTriggers > 0 ? `$${(totalSaved / totalTriggers).toFixed(0)}` : "\u2014"} sublabel="per trigger" />
      </div>

      {(savedChartData.length > 0 || triggerPieData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {savedChartData.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Value Saved by Wallet</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={savedChartData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total_value_saved_usd" radius={[4, 4, 0, 0]} fill="#ef4444" fillOpacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {triggerPieData.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Trigger Types</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={triggerPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                    {triggerPieData.map((entry, i) => (
                      <Cell key={i} fill={TRIGGER_COLORS[entry.name.toLowerCase()] || PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.8} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Configs */}
      <div>
        <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Protection Configs</h3>
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-gray-600 font-mono text-sm">Loading SOS data...</div>
          ) : configs.length === 0 ? (
            <div className="text-center py-12 bg-gray-900/30 border border-gray-800 rounded-xl">
              <ShieldAlert className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <p className="text-gray-500 font-mono text-sm">No protection configs yet</p>
            </div>
          ) : (
            configs.map((cfg) => (
              <div key={cfg.id} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 hover:border-red-500/20 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-bold font-mono text-sm">{cfg.wallet_address.slice(0, 6)}...{cfg.wallet_address.slice(-4)}</span>
                    <span className="px-1.5 py-0.5 rounded text-xs font-mono text-red-400 bg-red-500/10">
                      -{cfg.crash_threshold_pct}% crash
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-xs font-mono text-yellow-400 bg-yellow-500/10">
                      HF {cfg.health_factor_threshold}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${cfg.is_active ? "text-emerald-400 bg-emerald-500/10" : "text-gray-500 bg-gray-500/10"}`}>
                    {cfg.is_active ? "ARMED" : "PAUSED"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-gray-500">
                  <span>Protecting: {Array.isArray(cfg.tokens_to_protect) ? cfg.tokens_to_protect.length : 0} tokens</span>
                  <span>Exit to: {cfg.exit_to_token}</span>
                  <span>Fired: {cfg.triggers_fired ?? 0}x</span>
                  <span>Saved: ${cfg.total_value_saved_usd?.toFixed(0) ?? 0}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Events */}
      {events.length > 0 && (
        <div>
          <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Emergency Events</h3>
          <div className="space-y-2">
            {events.slice(0, 15).map((e) => (
              <div key={e.id} className="bg-gray-900/30 border border-gray-800/50 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-mono font-bold ${
                    e.trigger_type === "crash" ? "text-red-400 bg-red-500/10" :
                    e.trigger_type === "hack" ? "text-yellow-400 bg-yellow-500/10" :
                    e.trigger_type === "health" ? "text-blue-400 bg-blue-500/10" :
                    "text-purple-400 bg-purple-500/10"
                  }`}>
                    {e.trigger_type.toUpperCase()}
                  </span>
                  <span className="text-sm font-mono text-emerald-400">${e.total_value_saved_usd.toFixed(0)} saved</span>
                  <span className="text-xs font-mono text-gray-500">{e.exit_tx_hashes?.length ?? 0} txns</span>
                </div>
                <span className="text-xs text-gray-600 font-mono">{timeAgo(e.triggered_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

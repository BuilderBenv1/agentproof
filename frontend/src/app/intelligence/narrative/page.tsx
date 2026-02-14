"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, ArrowLeft } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import StatCard from "@/components/ui/StatCard";
import DateRangeFilter from "@/components/ui/DateRangeFilter";
import { intelligenceFetch } from "@/lib/intelligence";
import { timeAgo } from "@/lib/utils";

interface Trend {
  id: number;
  trend_name: string;
  category: string;
  momentum: string;
  sentiment_score: number;
  mention_count: number;
  tokens_mentioned: string[];
  summary: string | null;
  is_active: boolean;
  detected_at: string;
}

interface Sentiment {
  id: number;
  source_name: string;
  content_snippet: string;
  sentiment_score: number;
  tokens_mentioned: string[];
  analyzed_at: string;
}

interface NarrativeHealth {
  active_sources: number;
  trends_detected: number;
}

const MOMENTUM_COLORS: Record<string, string> = {
  rising: "#10b981",
  stable: "#eab308",
  falling: "#ef4444",
};

function momentumBadge(m: string) {
  if (m === "rising") return "text-emerald-400 bg-emerald-500/10";
  if (m === "falling") return "text-red-400 bg-red-500/10";
  return "text-yellow-400 bg-yellow-500/10";
}

function sentimentColor(s: number) {
  if (s > 0.3) return "text-emerald-400";
  if (s < -0.3) return "text-red-400";
  return "text-yellow-400";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono">
      <p className="text-white font-bold">{d.name || d.category}</p>
      {d.mention_count !== undefined && <p className="text-gray-400">{d.mention_count} mentions</p>}
      {d.sentiment_score !== undefined && <p className="text-emerald-400">Sentiment: {d.sentiment_score.toFixed(2)}</p>}
      {d.value !== undefined && <p className="text-gray-400">Count: {d.value}</p>}
    </div>
  );
};

export default function NarrativePage() {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [sentiments, setSentiments] = useState<Sentiment[]>([]);
  const [health, setHealth] = useState<NarrativeHealth | null>(null);
  const [since, setSince] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params: Record<string, string | number> = { limit: 30 };
        if (since) params.since = since;
        const [h, t, s] = await Promise.all([
          intelligenceFetch<NarrativeHealth>("/api/v1/narrative/health"),
          intelligenceFetch<Trend[]>("/api/v1/narrative/trends", { params: { limit: 20 } }),
          intelligenceFetch<Sentiment[]>("/api/v1/narrative/sentiment/recent", { params: { limit: 20 } }),
        ]);
        setHealth(h);
        setTrends(t);
        setSentiments(s);
      } catch {}
      setLoading(false);
    }
    load();
  }, [since]);

  const rising = trends.filter((t) => t.momentum === "rising").length;
  const falling = trends.filter((t) => t.momentum === "falling").length;
  const avgSentiment = sentiments.length > 0
    ? (sentiments.reduce((s, x) => s + x.sentiment_score, 0) / sentiments.length).toFixed(2)
    : "\u2014";

  // Momentum pie chart
  const momDist: Record<string, number> = {};
  trends.forEach((t) => { momDist[t.momentum] = (momDist[t.momentum] || 0) + 1; });
  const pieData = Object.entries(momDist).map(([name, value]) => ({
    name,
    value,
    fill: MOMENTUM_COLORS[name] || "#6b7280",
  }));

  // Top trends by mention count
  const trendBarData = [...trends]
    .sort((a, b) => b.mention_count - a.mention_count)
    .slice(0, 8)
    .map((t) => ({
      name: t.trend_name.length > 15 ? t.trend_name.slice(0, 15) + "..." : t.trend_name,
      mention_count: t.mention_count,
      sentiment_score: t.sentiment_score,
    }));

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/intelligence" className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Narrative Engine</h1>
            <p className="text-xs text-gray-500 font-mono">Social sentiment & trend detection across crypto media</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <DateRangeFilter value={since} onChange={setSince} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Trends" value={trends.length} sublabel={health ? `${health.active_sources} sources` : "detected"} />
        <StatCard label="Rising" value={rising} sublabel="gaining momentum" />
        <StatCard label="Falling" value={falling} sublabel="losing momentum" />
        <StatCard label="Avg Sentiment" value={avgSentiment} sublabel="recent items" />
      </div>

      {/* Charts */}
      {trends.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {pieData.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Momentum Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {trendBarData.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Top Trends by Mentions</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={trendBarData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} angle={-20} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="mention_count" radius={[4, 4, 0, 0]}>
                    {trendBarData.map((entry, i) => (
                      <Cell key={i} fill={entry.sentiment_score > 0.3 ? "#10b981" : entry.sentiment_score < -0.3 ? "#ef4444" : "#eab308"} fillOpacity={0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Trends */}
      <div>
        <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Active Trends</h3>
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-gray-600 font-mono text-sm">Loading narrative data...</div>
          ) : trends.length === 0 ? (
            <div className="text-center py-12 bg-gray-900/30 border border-gray-800 rounded-xl">
              <TrendingUp className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <p className="text-gray-500 font-mono text-sm">No trends detected yet</p>
            </div>
          ) : (
            trends.map((trend) => (
              <div
                key={trend.id}
                className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 hover:border-purple-500/20 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-bold">{trend.trend_name}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold uppercase ${momentumBadge(trend.momentum)}`}>
                      {trend.momentum}
                    </span>
                    <span className="text-xs font-mono text-gray-600 uppercase">{trend.category}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-mono text-sm font-bold ${sentimentColor(trend.sentiment_score)}`}>
                      {trend.sentiment_score > 0 ? "+" : ""}{trend.sentiment_score.toFixed(2)}
                    </span>
                    <span className="text-xs text-gray-600 font-mono">{trend.mention_count} mentions</span>
                  </div>
                </div>
                {trend.tokens_mentioned && trend.tokens_mentioned.length > 0 && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-xs text-gray-500 font-mono">TOKENS:</span>
                    {trend.tokens_mentioned.map((t) => (
                      <span key={t} className="px-1.5 py-0.5 rounded bg-gray-800 text-xs font-mono text-gray-300">{t}</span>
                    ))}
                  </div>
                )}
                {trend.summary && (
                  <p className="text-xs text-gray-500 leading-relaxed">{trend.summary}</p>
                )}
                <div className="text-right mt-1">
                  <span className="text-xs text-gray-600 font-mono">{timeAgo(trend.detected_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Sentiments */}
      {sentiments.length > 0 && (
        <div>
          <h3 className="text-sm font-mono text-gray-400 uppercase mb-4">Recent Sentiment</h3>
          <div className="space-y-2">
            {sentiments.slice(0, 10).map((s) => (
              <div
                key={s.id}
                className="bg-gray-900/30 border border-gray-800/50 rounded-lg p-3 flex items-center justify-between"
              >
                <div className="flex-1 mr-4">
                  <p className="text-xs text-gray-400 line-clamp-1">{s.content_snippet}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`font-mono text-xs font-bold ${sentimentColor(s.sentiment_score)}`}>
                    {s.sentiment_score > 0 ? "+" : ""}{s.sentiment_score.toFixed(2)}
                  </span>
                  <span className="text-xs text-gray-600 font-mono">{s.source_name}</span>
                  <span className="text-xs text-gray-700 font-mono">{timeAgo(s.analyzed_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

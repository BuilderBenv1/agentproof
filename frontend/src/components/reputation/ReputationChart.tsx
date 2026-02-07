"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  snapshot_date: string;
  composite_score: number;
  average_rating: number;
}

interface ReputationChartProps {
  data: DataPoint[];
}

export default function ReputationChart({ data }: ReputationChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-600 font-mono text-sm">
        No history data yet
      </div>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    date: new Date(d.snapshot_date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis
          dataKey="date"
          tick={{ fill: "#6b7280", fontSize: 11, fontFamily: "monospace" }}
          tickLine={false}
          axisLine={{ stroke: "#1f2937" }}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "#6b7280", fontSize: 11, fontFamily: "monospace" }}
          tickLine={false}
          axisLine={{ stroke: "#1f2937" }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#111827",
            border: "1px solid #374151",
            borderRadius: "8px",
            fontFamily: "monospace",
            fontSize: 12,
          }}
          labelStyle={{ color: "#9ca3af" }}
        />
        <Line
          type="monotone"
          dataKey="composite_score"
          stroke="#00E5A0"
          strokeWidth={2}
          dot={false}
          name="Score"
        />
        <Line
          type="monotone"
          dataKey="average_rating"
          stroke="#00C8FF"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
          name="Avg Rating"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

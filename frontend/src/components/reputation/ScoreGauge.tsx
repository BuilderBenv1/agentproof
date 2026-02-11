"use client";

import { getTierColor } from "@/lib/utils";

interface ScoreGaugeProps {
  score: number;
  tier: string;
  size?: "sm" | "md" | "lg";
  showTier?: boolean;
}

export default function ScoreGauge({ score, tier, size = "md", showTier = false }: ScoreGaugeProps) {
  const tierColor = getTierColor(tier);

  const dimensions = {
    sm: { w: 60, h: 60, r: 24, sw: 4, fs: "text-sm", tierFs: "text-[8px]" },
    md: { w: 100, h: 100, r: 40, sw: 6, fs: "text-xl", tierFs: "text-[10px]" },
    lg: { w: 160, h: 160, r: 65, sw: 8, fs: "text-3xl", tierFs: "text-xs" },
  }[size];

  const circumference = 2 * Math.PI * dimensions.r;
  const progress = (score / 100) * circumference;
  const dashOffset = circumference - progress;

  return (
    <div className="relative inline-flex flex-col items-center justify-center" style={{ width: dimensions.w }}>
      <div className="relative" style={{ width: dimensions.w, height: dimensions.h }}>
        <svg width={dimensions.w} height={dimensions.h} className="-rotate-90">
          {/* Background track */}
          <circle
            cx={dimensions.w / 2}
            cy={dimensions.h / 2}
            r={dimensions.r}
            fill="none"
            stroke="#1f2937"
            strokeWidth={dimensions.sw}
          />
          {/* Progress arc */}
          <circle
            cx={dimensions.w / 2}
            cy={dimensions.h / 2}
            r={dimensions.r}
            fill="none"
            stroke={tierColor}
            strokeWidth={dimensions.sw}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 8px ${tierColor}50)` }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`${dimensions.fs} font-bold font-mono text-white`}>
            {score.toFixed(0)}
          </span>
          {showTier && tier !== "unranked" && (
            <span
              className={`${dimensions.tierFs} font-mono font-bold uppercase mt-0.5`}
              style={{ color: tierColor }}
            >
              {tier}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

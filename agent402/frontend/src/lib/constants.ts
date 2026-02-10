export const TIER_COLORS: Record<string, string> = {
  diamond: "text-cyan-300 bg-cyan-500/10 border-cyan-500/30",
  platinum: "text-violet-300 bg-violet-500/10 border-violet-500/30",
  gold: "text-yellow-300 bg-yellow-500/10 border-yellow-500/30",
  silver: "text-gray-300 bg-gray-500/10 border-gray-500/30",
  bronze: "text-orange-300 bg-orange-500/10 border-orange-500/30",
  unranked: "text-muted bg-muted/10 border-muted/30",
};

export const TIER_ORDER = ["diamond", "platinum", "gold", "silver", "bronze", "unranked"];

export function getTierColor(tier: string): string {
  return TIER_COLORS[tier.toLowerCase()] || TIER_COLORS.unranked;
}

export function getScoreColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-primary-light";
  if (score >= 40) return "text-warning";
  return "text-danger";
}

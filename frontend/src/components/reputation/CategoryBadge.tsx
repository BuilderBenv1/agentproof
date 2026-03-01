"use client";

import {
  DollarSign,
  Gamepad2,
  Landmark,
  CreditCard,
  BarChart3,
  Bot,
  Shield,
  Wrench,
  Users,
  Vote,
} from "lucide-react";

const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  defi: { icon: DollarSign, color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
  gaming: { icon: Gamepad2, color: "text-purple-400 bg-purple-400/10 border-purple-400/20" },
  rwa: { icon: Landmark, color: "text-red-400 bg-red-400/10 border-red-400/20" },
  payments: { icon: CreditCard, color: "text-green-400 bg-green-400/10 border-green-400/20" },
  data: { icon: BarChart3, color: "text-red-300 bg-red-300/10 border-red-300/20" },
  security: { icon: Shield, color: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
  infrastructure: { icon: Wrench, color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20" },
  social: { icon: Users, color: "text-pink-400 bg-pink-400/10 border-pink-400/20" },
  governance: { icon: Vote, color: "text-indigo-400 bg-indigo-400/10 border-indigo-400/20" },
  general: { icon: Bot, color: "text-gray-400 bg-gray-400/10 border-gray-400/20" },
};

interface CategoryBadgeProps {
  category: string;
  showLabel?: boolean;
}

export default function CategoryBadge({ category, showLabel = true }: CategoryBadgeProps) {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.general;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono ${config.color}`}
    >
      <Icon className="w-3 h-3" />
      {showLabel && <span className="capitalize">{category}</span>}
    </span>
  );
}

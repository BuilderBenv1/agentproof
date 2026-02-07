"use client";

import Link from "next/link";
import { CATEGORIES } from "@/lib/constants";
import {
  DollarSign,
  Gamepad2,
  Landmark,
  CreditCard,
  BarChart3,
  Bot,
} from "lucide-react";

const ICONS: Record<string, React.ElementType> = {
  "dollar-sign": DollarSign,
  "gamepad-2": Gamepad2,
  landmark: Landmark,
  "credit-card": CreditCard,
  "bar-chart-3": BarChart3,
  bot: Bot,
};

export default function Sidebar() {
  return (
    <aside className="hidden lg:block w-56 flex-shrink-0">
      <div className="sticky top-20 space-y-1">
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3 px-3">
          Categories
        </p>
        {CATEGORIES.map((cat) => {
          const Icon = ICONS[cat.icon] || Bot;
          return (
            <Link
              key={cat.slug}
              href={`/agents?category=${cat.slug}`}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-mono text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
            >
              <Icon className="w-4 h-4" />
              {cat.name.replace(" Agents", "")}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}

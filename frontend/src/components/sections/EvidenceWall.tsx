"use client";

import Link from "next/link";
import { ExternalLink, AlertTriangle, FileText, BookOpen, TrendingUp, Quote, ArrowRight } from "lucide-react";
import { EVIDENCE, type EvidenceCardData, type EvidenceGroupData } from "@/lib/evidence-data";

const ICON_MAP: Record<string, React.ReactNode> = {
  FileText: <FileText className="w-4 h-4 text-amber-500" />,
  AlertTriangle: <AlertTriangle className="w-4 h-4 text-red-500" />,
  "AlertTriangle-400": <AlertTriangle className="w-4 h-4 text-red-400" />,
  BookOpen: <BookOpen className="w-4 h-4 text-purple-500" />,
  TrendingUp: <TrendingUp className="w-4 h-4 text-cyan-500" />,
  Quote: <Quote className="w-4 h-4 text-emerald-500" />,
};

function getIcon(group: EvidenceGroupData) {
  if (group.iconName === "AlertTriangle" && group.color === "text-red-400") {
    return ICON_MAP["AlertTriangle-400"];
  }
  return ICON_MAP[group.iconName];
}

function EvidenceCard({ card, groupColor, groupBorderColor }: { card: EvidenceCardData; groupColor: string; groupBorderColor: string }) {
  const borderClass = card.featured
    ? `${groupBorderColor.replace("/20", "/30")} shadow-lg`
    : "border-gray-800";

  return (
    <div
      className={`bg-gray-900/50 border ${borderClass} rounded-xl p-5 hover:border-gray-700 transition-all flex flex-col`}
    >
      <h3 className="text-sm font-bold text-white mb-2 leading-snug">{card.title}</h3>

      {card.quote && (
        <blockquote className={`border-l-2 ${groupBorderColor.replace("/20", "/40")} pl-3 mb-3`}>
          <p className="text-xs text-gray-300 italic leading-relaxed">{card.quote}</p>
        </blockquote>
      )}

      <p className="text-xs text-gray-500 leading-relaxed flex-1">{card.description}</p>

      {card.link && (
        <a
          href={card.link}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1.5 mt-3 text-[11px] font-mono ${groupColor} hover:opacity-80 transition-opacity`}
        >
          Read <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

function EvidenceGroup({ group }: { group: EvidenceGroupData }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className={`w-6 h-6 rounded-md ${group.bgColor} flex items-center justify-center`}>
          {getIcon(group)}
        </div>
        <span className={`text-xs font-mono uppercase tracking-wider ${group.color}`}>
          {group.label}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {group.cards.map((card) => (
          <EvidenceCard
            key={card.title}
            card={card}
            groupColor={group.color}
            groupBorderColor={group.borderColor}
          />
        ))}
      </div>
    </div>
  );
}

/** Featured cards for the homepage preview — the 3 strongest */
const PREVIEW_CARDS: { card: EvidenceCardData; groupColor: string; groupBorderColor: string; groupLabel: string; groupBgColor: string; icon: React.ReactNode }[] = [
  {
    card: EVIDENCE[0].cards[0], // Agents of Chaos
    groupColor: EVIDENCE[0].color,
    groupBorderColor: EVIDENCE[0].borderColor,
    groupLabel: EVIDENCE[0].label,
    groupBgColor: EVIDENCE[0].bgColor,
    icon: ICON_MAP.FileText,
  },
  {
    card: EVIDENCE[5].cards[0], // Garrett Droege / WTW
    groupColor: EVIDENCE[5].color,
    groupBorderColor: EVIDENCE[5].borderColor,
    groupLabel: EVIDENCE[5].label,
    groupBgColor: EVIDENCE[5].bgColor,
    icon: ICON_MAP.Quote,
  },
  {
    card: EVIDENCE[4].cards[1], // Aaron Levie / Box
    groupColor: EVIDENCE[4].color,
    groupBorderColor: EVIDENCE[4].borderColor,
    groupLabel: EVIDENCE[4].label,
    groupBgColor: EVIDENCE[4].bgColor,
    icon: ICON_MAP.TrendingUp,
  },
];

export function EvidencePreview() {
  const totalCards = EVIDENCE.reduce((sum, g) => sum + g.cards.length, 0);

  return (
    <section className="space-y-6">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">The Evidence</h2>
        <p className="text-gray-500 text-sm max-w-xl mx-auto font-mono">
          Research, incidents, and industry signals that validate a trust oracle for AI agents.
        </p>
      </div>

      {/* 3 featured cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PREVIEW_CARDS.map(({ card, groupColor, groupBorderColor, groupLabel, groupBgColor, icon }) => (
          <div key={card.title} className="flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-5 h-5 rounded ${groupBgColor} flex items-center justify-center`}>
                {icon}
              </div>
              <span className={`text-[10px] font-mono uppercase tracking-wider ${groupColor}`}>
                {groupLabel}
              </span>
            </div>
            <EvidenceCard card={card} groupColor={groupColor} groupBorderColor={groupBorderColor} />
          </div>
        ))}
      </div>

      {/* CTA to full page */}
      <div className="text-center">
        <Link
          href="/evidence"
          className="inline-flex items-center gap-2 px-5 py-2.5 border border-red-500/30 text-red-400 font-mono text-sm rounded-lg hover:bg-red-500/10 hover:border-red-500/50 transition-colors"
        >
          View all {totalCards} pieces of evidence <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </section>
  );
}

export default function EvidenceWall() {
  return (
    <div className="space-y-10">
      {/* Section header */}
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">The Evidence</h2>
        <p className="text-gray-500 text-sm max-w-xl mx-auto font-mono">
          Research, incidents, and industry signals that validate a trust oracle for AI agents.
        </p>
      </div>

      {/* All evidence groups */}
      {EVIDENCE.map((group) => (
        <EvidenceGroup key={group.label} group={group} />
      ))}
    </div>
  );
}

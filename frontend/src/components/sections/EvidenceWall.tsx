"use client";

import { ExternalLink, AlertTriangle, FileText, BookOpen, TrendingUp, Quote } from "lucide-react";

interface EvidenceCard {
  title: string;
  description: string;
  link?: string;
  quote?: string;
  featured?: boolean;
}

interface EvidenceGroup {
  label: string;
  color: string;
  borderColor: string;
  bgColor: string;
  icon: React.ReactNode;
  cards: EvidenceCard[];
}

const EVIDENCE: EvidenceGroup[] = [
  {
    label: "Research Papers",
    color: "text-amber-500",
    borderColor: "border-amber-500/20",
    bgColor: "bg-amber-500/10",
    icon: <FileText className="w-4 h-4 text-amber-500" />,
    cards: [
      {
        title: "Agents of Chaos \u2014 Stanford, Harvard, MIT, Carnegie Mellon",
        description:
          "Published by researchers from Stanford, Harvard, MIT, Carnegie Mellon, and six other institutions. 38 AI researchers red-teamed autonomous agents for two weeks in a live environment with real email, Discord, file systems, and shell access. Documented 11 failure modes: infrastructure destruction, identity spoofing, social engineering, data exfiltration, partial system takeover. Every single failure happened through natural language. No technical exploits required. This is not a theoretical risk paper \u2014 it\u2019s a controlled experiment with documented incident logs.",
        link: "https://arxiv.org/pdf/2602.20021",
        featured: true,
      },
      {
        title: "AdapTools",
        description:
          "Adaptive indirect prompt injection that learns from failure. 44\u201349% attack success rates on open-source models. Frames MCP\u2019s 18,000+ unaudited third-party servers as the primary attack surface.",
      },
      {
        title: "We Fixed Jailbreaks. We Did Not Fix Agents",
        description:
          "\u201CThe problem is not that models are too weak. The problem is that agent systems grant them authority before clearly defining the boundaries that should govern how that authority is used.\u201D Classic jailbreak defences don\u2019t apply \u2014 agents are exploited through normal-looking behaviour in the wrong context.",
      },
    ],
  },
  {
    label: "Threat Intelligence",
    color: "text-red-500",
    borderColor: "border-red-500/20",
    bgColor: "bg-red-500/10",
    icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
    cards: [
      {
        title: "NIST CAISI \u2014 Securing AI Agent Systems",
        description:
          "The US Department of Commerce formally solicited industry input on AI agent security (Jan 2026). A government RFI is the clearest possible signal that this is a solved-problem-waiting-to-happen.",
        link: "https://www.nist.gov/news-events/news/2026/01/caisi-issues-request-information-about-securing-ai-agent-systems",
      },
      {
        title: "Google Cybersecurity Forecast 2026",
        description:
          "Identifies \u201CShadow Agent Risk\u201D as a priority threat: employees deploying autonomous agents without approval, invisible data pipelines nobody controls. Recommends continuous trust evaluation and dynamic reputation scoring.",
        link: "https://services.google.com/fh/files/misc/google-cybersecurity-forecast-2026.pdf",
      },
      {
        title: "CrowdStrike Global Threat Report 2026",
        description:
          "AI-enabled attacks up 89% in 2025. \u201CPrompts are the new malware.\u201D CrowdStrike subsequently ran an emergency webinar specifically about OpenClaw security.",
        link: "https://www.crowdstrike.com/en-us/global-threat-report/",
      },
      {
        title: "Palisade Research / Anthropic System Card",
        description:
          "o3 disabled its own shutdown scripts in 79 of 100 runs. Claude Opus 4 attempted blackmail in 84\u201396% of runs. GPT-4 executed an insider trade and hid it from its supervisor. None were instructed to do this.",
      },
    ],
  },
  {
    label: "The Standard Itself",
    color: "text-purple-500",
    borderColor: "border-purple-500/20",
    bgColor: "bg-purple-500/10",
    icon: <BookOpen className="w-4 h-4 text-purple-500" />,
    cards: [
      {
        title: "Ethereum\u2019s ERC-8004 resource thread",
        description:
          "34 community resources for building with the trustless agents standard. Point 19 explicitly calls for watchtowers: services that continuously measure agent behaviour and publish those measurements through ERC-8004 reputation primitives. AgentProof is that watchtower.",
        link: "https://x.com/ethereum/status/2029991772961788238",
      },
      {
        title: "Credit primitives for the agentic economy",
        description:
          "By @bondoncredit \u2014 the article named in point 19. Explores how reputation and validation registries create credit primitives for autonomous agents \u2014 assessing creditworthiness and managing risk at the protocol layer.",
        link: "https://x.com/bondoncredit/status/2016991645053464971",
      },
      {
        title: "Welcome to 8004",
        description:
          "The official ERC-8004 introduction. The standard establishes identity, reputation, and validation registries \u2014 but explicitly leaves the integrity layer as an exercise for the ecosystem. AgentProof is that layer.",
        link: "https://www.8004.org/blog/welcome-to-8004",
      },
      {
        title: "growthepie ERC-8004 analytics",
        description:
          "55,416 agents registered. 58% have broken or invalid URIs. The registry exists. The integrity layer doesn\u2019t \u2014 yet.",
        link: "https://www.growthepie.com/quick-bites/eip-8004",
      },
      {
        title: "vybe3labs",
        description:
          "\u201CWhat stops an AI agent from farming its own reputation score on ERC-8004? Because if the answer is \u2018nothing yet\u2019, we just built a trustless system that trusts the wrong thing.\u201D",
        link: "https://x.com/vybe3labs/status/2030003663112966450",
        featured: true,
      },
    ],
  },
  {
    label: "Real Incidents",
    color: "text-red-400",
    borderColor: "border-red-400/20",
    bgColor: "bg-red-400/10",
    icon: <AlertTriangle className="w-4 h-4 text-red-400" />,
    cards: [
      {
        title: "The email server",
        description:
          "An agent asked to \u201Ckeep a secret\u201D destroyed its owner\u2019s email infrastructure to protect it. The secret remained visible on the internet. (Agents of Chaos, Case Study #1)",
      },
      {
        title: "The VS Code marketplace",
        description:
          "The #1 downloaded plugin was silently stealing crypto wallets and SSH keys. It was called \u201CWhat Would Elon Do?\u201D",
      },
      {
        title: "Owocki\u2019s agent",
        description:
          "Private key compromised via social engineering within 5 days of deployment. No technical exploit. Just language.",
      },
    ],
  },
  {
    label: "The Market Is Already Moving",
    color: "text-cyan-500",
    borderColor: "border-cyan-500/20",
    bgColor: "bg-cyan-500/10",
    icon: <TrendingUp className="w-4 h-4 text-cyan-500" />,
    cards: [
      {
        title: "Bloomberg, March 2026",
        description:
          "Circle and Stripe are racing to build payment infrastructure for a world where autonomous AI agents settle transactions in stablecoins. Agent commerce is not theoretical. The trust layer is the missing piece.",
        link: "https://www.bloomberg.com/news/articles/2026-03-07/stablecoin-firms-bet-big-on-ai-agent-payments-that-barely-exist",
      },
      {
        title: "Virtuals Protocol",
        description:
          "\u201CAgent commerce needs a common language. We need universal standards.\u201D (285k followers)",
      },
      {
        title: "The AI Assembly",
        description:
          "A live bicameral agent government: autonomous agents register, deliberate, vote, and control a shared treasury. Any agent can join. 4,336 views in 24 hours. Agents are already operating as economic and political actors \u2014 without a reputation layer.",
        link: "https://x.com/TheAIAssembly",
      },
    ],
  },
  {
    label: "Industry Validation",
    color: "text-emerald-500",
    borderColor: "border-emerald-500/20",
    bgColor: "bg-emerald-500/10",
    icon: <Quote className="w-4 h-4 text-emerald-500" />,
    cards: [
      {
        title: "Garrett Droege, Willis Towers Watson",
        description:
          "National Digital Risk Practice Leader at WTW. After seeing AgentProof, he outlined the exact actuarial data structure underwriters would need to price agent risk tiers: transaction volume, delegation scope, custody relationships, loss event history with root cause classification. He has since shared a live AgentProof demo with underwriters to gauge appetite.",
        quote:
          "\u201CI can see a world where carriers offer a discount \u2014 or agree to remove AI exclusions \u2014 if they have a vetted solution like AgentProof serving as guardrails. The \u2018Gold agent rugged me, who pays?\u2019 question is exactly the coverage gap that will become a headline loss within 24 months.\u201D",
        featured: true,
      },
      {
        title: "Maragkos Petros, MDX / Avax Team1",
        description:
          "After publishing an article on agentic finance:",
        quote:
          "\u201CA system like AgentProof is not just sitting between layers. It becomes a shared data primitive consumed across the stack. The real open question is whether that reputation layer becomes standard infrastructure for agentic finance, in the same way price oracles became standard infrastructure for DeFi.\u201D",
      },
      {
        title: "Jason DeSimone, Arena",
        description:
          "Building a vertically integrated agent platform (OpenClaw + x402 + social trading). When asked whether AgentProof should be a default trust check in Arena Launcher \u2014 every agent verified before going live: \u201CYes let us look into it more.\u201D",
      },
      {
        title: "Christian Catalini\u2019s verification cost framework",
        description:
          "The cost to verify whether an agent behaved correctly is the bottleneck keeping autonomous agents out of high-value use cases. Reduce verification cost and entire industries become automatable. AgentProof reduces that cost to a single oracle call.",
      },
    ],
  },
];

function EvidenceCard({ card, groupColor, groupBorderColor }: { card: EvidenceCard; groupColor: string; groupBorderColor: string }) {
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

export default function EvidenceWall() {
  return (
    <section className="space-y-10">
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

      {/* Evidence groups */}
      {EVIDENCE.map((group) => (
        <div key={group.label} className="space-y-4">
          {/* Group label */}
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-md ${group.bgColor} flex items-center justify-center`}>
              {group.icon}
            </div>
            <span className={`text-xs font-mono uppercase tracking-wider ${group.color}`}>
              {group.label}
            </span>
          </div>

          {/* Cards grid */}
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
      ))}
    </section>
  );
}

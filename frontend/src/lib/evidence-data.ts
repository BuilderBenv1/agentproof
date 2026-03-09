export interface EvidenceCardData {
  title: string;
  description: string;
  link?: string;
  quote?: string;
  featured?: boolean;
}

export interface EvidenceGroupData {
  label: string;
  color: string;
  borderColor: string;
  bgColor: string;
  iconName: "FileText" | "AlertTriangle" | "BookOpen" | "TrendingUp" | "Quote";
  cards: EvidenceCardData[];
}

export const EVIDENCE: EvidenceGroupData[] = [
  {
    label: "Research Papers",
    color: "text-amber-500",
    borderColor: "border-amber-500/20",
    bgColor: "bg-amber-500/10",
    iconName: "FileText",
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
      {
        title: "Can LLM Agents Reach Consensus? The Byzantine Problem Revisited",
        description:
          "Researchers tested whether LLM agents can achieve Byzantine consensus \u2014 the 40-year-old distributed systems problem of reaching agreement when some participants are malicious. A single bad actor collapses network consensus. More alarming \u2014 in fully benign settings with zero bad actors, LLM agents still fail to converge. They stall, time out, and go in circles. The reason is fundamental: classical consensus protocols assume deterministic state machines. LLMs are stochastic \u2014 the same prompt produces different outputs across runs. An agreement that holds in round 3 can dissolve in round 4. The implication for anyone building multi-agent systems for finance, healthcare, or autonomous infrastructure: reliable coordination isn\u2019t an emergent property of putting smart agents together. It has to be engineered explicitly, with formal guarantees. \u201CMore agents = better answers\u201D has a ceiling nobody\u2019s measuring.",
        link: "https://arxiv.org/abs/2603.01213",
      },
    ],
  },
  {
    label: "Threat Intelligence",
    color: "text-red-500",
    borderColor: "border-red-500/20",
    bgColor: "bg-red-500/10",
    iconName: "AlertTriangle",
    cards: [
      {
        title: "President Trump\u2019s Cyber Strategy for America \u2014 White House, March 2026",
        description:
          "The US government\u2019s national cybersecurity strategy explicitly names agentic AI as a priority threat surface. Pillar 5: \u201CWe will rapidly adopt and promote agentic AI in ways that securely scale network defense and disruption\u201D and calls for securing \u201Cthe AI technology stack\u201D and promoting \u201Cinnovation in AI security.\u201D The strategy also commits to supporting the security of blockchain technologies. This is not a think tank report \u2014 it is sitting US government policy identifying agentic AI security as a national priority.",
        link: "https://www.whitehouse.gov/wp-content/uploads/2026/03/President-Trumps-Cyber-Strategy-for-America.pdf",
        featured: true,
      },
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
      {
        title: "Craig Riddell, Global Field CISO at Wallarm",
        description:
          "\u201CAI agents are no longer experimental. They are operational. And now they are being targeted.\u201D Infostealer malware was observed extracting API credentials and tokens directly from live AI agent environments. When an attacker steals an agent\u2019s API keys they don\u2019t just gain access \u2014 they inherit trust relationships, delegated privileges, and the ability to execute business logic at machine speed. The API calls look valid. The credentials are real. The traffic blends in.",
        quote:
          "\u201CThis is not a signature problem. It is a behavioral governance problem. Are we watching what our agents do in motion, or just what credentials they carry?\u201D",
        link: "https://www.techradar.com/pro/security/openclaw-ai-agents-targeted-by-infostealer-malware-for-the-first-time",
      },
    ],
  },
  {
    label: "The Standard Itself",
    color: "text-purple-500",
    borderColor: "border-purple-500/20",
    bgColor: "bg-purple-500/10",
    iconName: "BookOpen",
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
    iconName: "AlertTriangle",
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
    iconName: "TrendingUp",
    cards: [
      {
        title: "LinkedIn Economic Graph \u2014 AI Skills Report 2026",
        description:
          "Data from over one billion professionals shows AI Agents as one of the fastest-growing skills globally. As autonomous agents enter the workforce at scale, LinkedIn\u2019s own research flags the core problem: capability claims are increasingly unverifiable. \u201CAs resumes become easier to embellish and skills evolve rapidly, leaders must verify real capability beyond titles and tenure.\u201D The same verification gap exists for agents \u2014 and unlike humans, agents have no CV, no references, and no employment history. Just a wallet address.",
        link: "https://economicgraph.linkedin.com/research/ai-skills-resources",
      },
      {
        title: "Aaron Levie, CEO of Box \u2014 \u201CBuilding for Trillions of Agents\u201D",
        description:
          "A full thesis on the agentic future from the CEO of a $4bn enterprise software company. He names the scale: enterprises with 100x or 1,000x more agents than people. Agents as the primary users of all software. Trillions of agents. Without a trust layer, that\u2019s trillions of unverified actors.",
        quote:
          "\u201CSecurity, compliance, and governance will become a major problem for these agents. Long-running agents will likely need their own identities that allow them to authenticate into services, offering strict controls on what types of actions they can take and what data they have access to. We\u2019ll need all new software and platforms to help with these challenges.\u201D",
        link: "https://x.com/levie",
        featured: true,
      },
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
      {
        title: "Kite AI \u2014 \u201CThe First AI Payment Blockchain\u201D",
        description:
          "Building an agent marketplace where users shop, transact, and coordinate through autonomous agents. Their four core pillars are Identity, Reputation, Spending, and Security. On reputation: \u201CBuild a track record for every agent through signed usage logs and attestations. Others can verify this history to decide how and when to interact or transact.\u201D A consumer-facing agent economy being built from scratch is explicitly architecting reputation as load-bearing infrastructure \u2014 not optional. The agent store is launching on Claude first.",
        link: "https://gokite.ai/network",
      },
    ],
  },
  {
    label: "Industry Validation",
    color: "text-emerald-500",
    borderColor: "border-emerald-500/20",
    bgColor: "bg-emerald-500/10",
    iconName: "Quote",
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
      {
        title: "@invisiblebags \u2014 Invisible (10 GPU AI infrastructure)",
        description:
          "\u201CImagine every agent had a digital signature \u2014 this powers anything and everything they do online. A central service where agents obtain an ID, and another where IDs are verified. Any app or service natively building for agents can integrate to verify ownership and audit actions.\u201D That\u2019s a description of ERC-8004 plus AgentProof. Someone building serious AI infrastructure independently arrived at the same architecture.",
      },
    ],
  },
];

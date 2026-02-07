import { useState } from "react";

const sections = [
  {
    id: "thesis",
    label: "Thesis",
    icon: "◆",
  },
  {
    id: "architecture",
    label: "Architecture",
    icon: "⬡",
  },
  {
    id: "revenue",
    label: "Revenue",
    icon: "$",
  },
  {
    id: "roadmap",
    label: "Roadmap",
    icon: "→",
  },
  {
    id: "advantages",
    label: "Your Edge",
    icon: "★",
  },
];

const architectureLayers = [
  {
    name: "Agent Registry Layer",
    tech: "ERC-8004 Identity Registry",
    desc: "Agents register with verifiable onchain identity. Each agent gets an ERC-721 NFT as their portable ID across Avalanche L1s and C-Chain.",
    color: "#00E5A0",
  },
  {
    name: "Performance Oracle",
    tech: "Reputation Registry + Custom Indexer",
    desc: "Track agent performance in real-time. P&L, win rates, drawdown, Sharpe ratios — all cryptographically verified and publicly auditable. The PuntHub model, but for AI agents.",
    color: "#00C8FF",
  },
  {
    name: "Validation Engine",
    tech: "Validation Registry + zkProofs",
    desc: "Independent validators verify agent claims. Did the trading bot actually execute that strategy? Did the gaming agent complete the task? Stake-secured re-execution prevents fraud.",
    color: "#A78BFA",
  },
  {
    name: "Settlement & Payments",
    tech: "x402 + Stablecoin Rails",
    desc: "Agents pay for services, earn fees, and settle disputes — all in USDC/USDT on Avalanche with sub-second finality. Revenue sharing built into the protocol.",
    color: "#FF6B6B",
  },
];

const revenueStreams = [
  {
    stream: "Agent Registration Fees",
    model: "One-time bond + annual renewal",
    potential: "Anti-sybil + recurring revenue",
  },
  {
    stream: "Premium Reputation Analytics",
    model: "SaaS tier for advanced agent scoring, alerts, and portfolio tools",
    potential: "Your PuntHub playbook — freemium with pro tiers",
  },
  {
    stream: "Validation Staking",
    model: "Validators stake to verify agent performance, earn fees",
    potential: "Protocol-level yield generation",
  },
  {
    stream: "Agent Marketplace Commission",
    model: "% cut on agent-to-agent and user-to-agent transactions",
    potential: "Network effects compound with adoption",
  },
  {
    stream: "Enterprise API Access",
    model: "Institutional-grade agent vetting and compliance feeds",
    potential: "RWA firms, funds, and gaming studios need trusted agents",
  },
];

const roadmap = [
  {
    phase: "Phase 1",
    title: "Foundation",
    timeline: "Months 1-2",
    items: [
      "Deploy ERC-8004 registry contracts on Avalanche C-Chain",
      "Build agent registration + identity management UI",
      "Implement basic reputation tracking (PuntHub-style public leaderboards)",
      "Subgraph indexer for registry events",
    ],
  },
  {
    phase: "Phase 2",
    title: "Intelligence",
    timeline: "Months 3-4",
    items: [
      "Advanced scoring algorithms (Elo-style, category-weighted)",
      "Real-time performance dashboards per agent",
      "API for third-party integrations",
      "First vertical: DeFi trading agents on Avalanche",
    ],
  },
  {
    phase: "Phase 3",
    title: "Expansion",
    timeline: "Months 5-6",
    items: [
      "Gaming agent vertical (L1 ecosystem — Grotto, Henesys, etc.)",
      "Cross-L1 agent reputation portability",
      "Validation marketplace with staked validators",
      "Agent-to-agent service marketplace",
    ],
  },
  {
    phase: "Phase 4",
    title: "Network Effects",
    timeline: "Months 7+",
    items: [
      "Enterprise/institutional tier for RWA agent vetting",
      "Insurance pools for high-value agent interactions",
      "Governance token + protocol decentralisation",
      "Expand beyond Avalanche — multi-chain reputation layer",
    ],
  },
];

const edges = [
  {
    title: "10 Years of Reputation Systems",
    detail:
      "PuntHub is a live, battle-tested transparent vetting platform. You've solved the cold-start problem, gaming prevention, and public accountability in betting — all directly applicable to agent reputation.",
  },
  {
    title: "Automation DNA",
    detail:
      "xCloudBot automates betting execution at scale. You understand what autonomous agents need because you've been building them for a decade — just calling them 'bots' instead of 'agents'.",
  },
  {
    title: "Avalanche Native",
    detail:
      "Player1 Protocol and FC Onchain Manager give you existing relationships and credibility in the Avalanche ecosystem. You know the L1 architecture, the teams, and the grant landscape.",
  },
  {
    title: "Full-Stack Builder",
    detail:
      "FastAPI, React, Supabase, Playwright, Python ML pipelines — you can ship the entire stack solo. Most web3 teams need 5 people to do what you do alone.",
  },
  {
    title: "Data Pipeline Expertise",
    detail:
      "The London planning scraper (32 borough portals), racing data pipelines, result tracking systems — you build industrial-grade data infrastructure. Agent reputation IS a data pipeline problem.",
  },
];

export default function AgentReputationConcept() {
  const [activeSection, setActiveSection] = useState("thesis");
  const [expandedEdge, setExpandedEdge] = useState(null);
  const [hoveredLayer, setHoveredLayer] = useState(null);

  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        background: "#0A0A0F",
        color: "#E8E8ED",
        minHeight: "100vh",
        padding: "0",
        overflow: "hidden",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />

      {/* Header */}
      <div
        style={{
          padding: "32px 24px 24px",
          borderBottom: "1px solid rgba(0, 229, 160, 0.15)",
          background:
            "linear-gradient(180deg, rgba(0, 229, 160, 0.03) 0%, transparent 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "8px",
          }}
        >
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: "#00E5A0",
              boxShadow: "0 0 12px rgba(0, 229, 160, 0.5)",
              animation: "pulse 2s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontSize: "11px",
              letterSpacing: "3px",
              color: "#00E5A0",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Product Concept
          </span>
        </div>
        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: "28px",
            fontWeight: 700,
            margin: "0 0 6px",
            background: "linear-gradient(135deg, #FFFFFF 0%, #00E5A0 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            lineHeight: 1.2,
          }}
        >
          AgentProof
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "#888",
            margin: 0,
            fontWeight: 300,
            lineHeight: 1.5,
          }}
        >
          Transparent reputation infrastructure for autonomous AI agents on
          Avalanche — built on ERC-8004
        </p>
      </div>

      {/* Navigation */}
      <div
        style={{
          display: "flex",
          gap: "0",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          overflow: "auto",
        }}
      >
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            style={{
              flex: 1,
              padding: "14px 8px",
              background:
                activeSection === s.id
                  ? "rgba(0, 229, 160, 0.08)"
                  : "transparent",
              border: "none",
              borderBottom:
                activeSection === s.id
                  ? "2px solid #00E5A0"
                  : "2px solid transparent",
              color: activeSection === s.id ? "#00E5A0" : "#555",
              cursor: "pointer",
              fontSize: "11px",
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "1px",
              textTransform: "uppercase",
              transition: "all 0.2s ease",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ marginRight: "4px" }}>{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "24px", maxHeight: "60vh", overflow: "auto" }}>
        {/* THESIS */}
        {activeSection === "thesis" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <div
              style={{
                background:
                  "linear-gradient(135deg, rgba(0, 229, 160, 0.06) 0%, rgba(0, 200, 255, 0.04) 100%)",
                border: "1px solid rgba(0, 229, 160, 0.12)",
                borderRadius: "8px",
                padding: "20px",
                marginBottom: "20px",
              }}
            >
              <p
                style={{
                  fontSize: "15px",
                  lineHeight: 1.7,
                  margin: 0,
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 400,
                  color: "#CCC",
                }}
              >
                24,500+ AI agents registered on ERC-8004 in the first week.
                Zero infrastructure exists to publicly vet them. The same
                problem PuntHub solved for betting tipsters now exists at 1000x
                scale for AI agents.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {[
                {
                  q: "The Problem",
                  a: 'AI agents are registering onchain at pace, but there\'s no way to know which ones actually perform. It\'s the wild west — exactly like the tipster industry before PuntHub. Everyone claims 90% strike rates. Nobody proves it publicly.',
                },
                {
                  q: "The Insight",
                  a: "You've already solved this. PuntHub's model of transparent, public, independently verified performance tracking is exactly what the agent economy needs. The ERC-8004 Reputation Registry provides the standard — but someone needs to build the intelligence layer on top.",
                },
                {
                  q: "The Product",
                  a: "AgentProof: a reputation and analytics protocol for AI agents on Avalanche. Register, track, verify, and rank autonomous agents with cryptographically proven performance records. Think PuntHub meets DefiLlama, purpose-built for the agent economy.",
                },
                {
                  q: "Why Avalanche",
                  a: "Sub-second finality (Granite upgrade), 75+ active L1s creating agent demand across gaming/DeFi/RWA, ERC-8004 now live on C-Chain, and the Retro9000 grant programme actively funding this kind of infrastructure.",
                },
              ].map((item, i) => (
                <div key={i}>
                  <h3
                    style={{
                      fontSize: "12px",
                      color: "#00E5A0",
                      letterSpacing: "2px",
                      textTransform: "uppercase",
                      margin: "0 0 8px",
                      fontWeight: 600,
                    }}
                  >
                    {item.q}
                  </h3>
                  <p
                    style={{
                      fontSize: "13px",
                      lineHeight: 1.7,
                      color: "#AAA",
                      margin: 0,
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ARCHITECTURE */}
        {activeSection === "architecture" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <p
              style={{
                fontSize: "12px",
                color: "#666",
                marginTop: 0,
                marginBottom: "20px",
                letterSpacing: "1px",
              }}
            >
              STACK OVERVIEW — TAP TO EXPAND
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "3px",
              }}
            >
              {architectureLayers.map((layer, i) => (
                <div
                  key={i}
                  onClick={() =>
                    setHoveredLayer(hoveredLayer === i ? null : i)
                  }
                  style={{
                    background:
                      hoveredLayer === i
                        ? `linear-gradient(90deg, ${layer.color}12 0%, transparent 100%)`
                        : "rgba(255,255,255,0.02)",
                    border: `1px solid ${hoveredLayer === i ? layer.color + "40" : "rgba(255,255,255,0.04)"}`,
                    borderRadius: "6px",
                    padding: "16px",
                    cursor: "pointer",
                    transition: "all 0.25s ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: hoveredLayer === i ? "10px" : "0",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "2px",
                          background: layer.color,
                          boxShadow: hoveredLayer === i ? `0 0 8px ${layer.color}60` : "none",
                        }}
                      />
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: hoveredLayer === i ? "#FFF" : "#CCC",
                        }}
                      >
                        {layer.name}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: "10px",
                        color: layer.color,
                        letterSpacing: "0.5px",
                        opacity: 0.7,
                      }}
                    >
                      {layer.tech}
                    </span>
                  </div>
                  {hoveredLayer === i && (
                    <p
                      style={{
                        fontSize: "12px",
                        lineHeight: 1.7,
                        color: "#999",
                        margin: 0,
                        fontFamily: "'Space Grotesk', sans-serif",
                        paddingLeft: "18px",
                      }}
                    >
                      {layer.desc}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: "20px",
                padding: "16px",
                background: "rgba(167, 139, 250, 0.05)",
                border: "1px solid rgba(167, 139, 250, 0.12)",
                borderRadius: "6px",
              }}
            >
              <h4
                style={{
                  fontSize: "11px",
                  color: "#A78BFA",
                  letterSpacing: "2px",
                  margin: "0 0 8px",
                  textTransform: "uppercase",
                }}
              >
                Tech Stack
              </h4>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                }}
              >
                {[
                  "Solidity",
                  "FastAPI",
                  "React / Next.js",
                  "Supabase",
                  "The Graph",
                  "Python ML",
                  "Avalanche C-Chain",
                  "ERC-8004",
                  "IPFS",
                  "x402",
                ].map((tech) => (
                  <span
                    key={tech}
                    style={{
                      fontSize: "10px",
                      padding: "4px 10px",
                      borderRadius: "4px",
                      background: "rgba(167, 139, 250, 0.08)",
                      border: "1px solid rgba(167, 139, 250, 0.15)",
                      color: "#A78BFA",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* REVENUE */}
        {activeSection === "revenue" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <p
              style={{
                fontSize: "12px",
                color: "#666",
                marginTop: 0,
                marginBottom: "20px",
                letterSpacing: "1px",
              }}
            >
              MONETISATION STRATEGY
            </p>
            {revenueStreams.map((r, i) => (
              <div
                key={i}
                style={{
                  padding: "16px",
                  marginBottom: "8px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: "6px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "6px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#E8E8ED",
                    }}
                  >
                    {r.stream}
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "2px 8px",
                      borderRadius: "3px",
                      background: "rgba(0, 229, 160, 0.08)",
                      color: "#00E5A0",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.model}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "12px",
                    color: "#777",
                    margin: 0,
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  {r.potential}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* ROADMAP */}
        {activeSection === "roadmap" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            {roadmap.map((phase, i) => (
              <div
                key={i}
                style={{
                  marginBottom: "24px",
                  position: "relative",
                  paddingLeft: "20px",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "6px",
                    bottom: i === roadmap.length - 1 ? "auto" : "-24px",
                    width: "2px",
                    background:
                      i === 0
                        ? "#00E5A0"
                        : `linear-gradient(180deg, rgba(0,229,160,${0.6 - i * 0.15}) 0%, rgba(0,229,160,${0.3 - i * 0.08}) 100%)`,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: "-4px",
                    top: "4px",
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: i === 0 ? "#00E5A0" : "#1a1a2e",
                    border: `2px solid ${i === 0 ? "#00E5A0" : "rgba(0,229,160,0.3)"}`,
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "10px",
                    marginBottom: "10px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#00E5A0",
                      fontWeight: 600,
                      letterSpacing: "1px",
                    }}
                  >
                    {phase.phase}
                  </span>
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      fontFamily: "'Space Grotesk', sans-serif",
                      color: "#E8E8ED",
                    }}
                  >
                    {phase.title}
                  </span>
                  <span
                    style={{ fontSize: "11px", color: "#555" }}
                  >
                    {phase.timeline}
                  </span>
                </div>
                {phase.items.map((item, j) => (
                  <div
                    key={j}
                    style={{
                      fontSize: "12px",
                      color: "#888",
                      lineHeight: 1.8,
                      fontFamily: "'Space Grotesk', sans-serif",
                      paddingLeft: "4px",
                    }}
                  >
                    <span style={{ color: "#333", marginRight: "8px" }}>—</span>
                    {item}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* YOUR EDGE */}
        {activeSection === "advantages" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <p
              style={{
                fontSize: "12px",
                color: "#666",
                marginTop: 0,
                marginBottom: "20px",
                letterSpacing: "1px",
              }}
            >
              WHY YOU — TAP TO EXPAND
            </p>
            {edges.map((edge, i) => (
              <div
                key={i}
                onClick={() =>
                  setExpandedEdge(expandedEdge === i ? null : i)
                }
                style={{
                  padding: "14px 16px",
                  marginBottom: "6px",
                  background:
                    expandedEdge === i
                      ? "rgba(0, 229, 160, 0.05)"
                      : "rgba(255,255,255,0.02)",
                  border: `1px solid ${expandedEdge === i ? "rgba(0, 229, 160, 0.15)" : "rgba(255,255,255,0.04)"}`,
                  borderRadius: "6px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: expandedEdge === i ? "#00E5A0" : "#CCC",
                    }}
                  >
                    {edge.title}
                  </span>
                  <span
                    style={{
                      color: "#555",
                      fontSize: "14px",
                      transform: expandedEdge === i ? "rotate(45deg)" : "none",
                      transition: "transform 0.2s ease",
                    }}
                  >
                    +
                  </span>
                </div>
                {expandedEdge === i && (
                  <p
                    style={{
                      fontSize: "12px",
                      lineHeight: 1.7,
                      color: "#888",
                      margin: "10px 0 0",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    {edge.detail}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "16px 24px",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: "10px", color: "#333", letterSpacing: "1px" }}>
          AGENTPROOF × AVALANCHE
        </span>
        <span style={{ fontSize: "10px", color: "#333" }}>
          ERC-8004 · C-CHAIN
        </span>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,229,160,0.15); border-radius: 2px; }
      `}</style>
    </div>
  );
}

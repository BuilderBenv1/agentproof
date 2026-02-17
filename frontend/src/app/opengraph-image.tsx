import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AgentProof — Trust oracle for the ERC-8004 agent economy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0A0A0F 0%, #0F1118 100%)",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Subtle glow */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 800,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(16,185,129,0.12) 0%, transparent 70%)",
          }}
        />

        {/* Shield + Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span style={{ fontSize: 64, fontWeight: 800, color: "white" }}>Agent</span>
            <span style={{ fontSize: 64, fontWeight: 800, color: "#34D399" }}>Proof</span>
          </div>
        </div>

        {/* ERC-8004 badge */}
        <div
          style={{
            display: "flex",
            padding: "4px 12px",
            borderRadius: 6,
            border: "1px solid rgba(16,185,129,0.3)",
            background: "rgba(16,185,129,0.08)",
            marginBottom: 24,
          }}
        >
          <span style={{ fontSize: 13, fontFamily: "monospace", color: "#34D399", opacity: 0.8 }}>
            ERC-8004
          </span>
        </div>

        {/* Tagline */}
        <p style={{ fontSize: 28, color: "#9CA3AF", marginBottom: 48 }}>
          Trust oracle for the ERC-8004 agent economy
        </p>

        {/* Stats */}
        <div style={{ display: "flex", gap: 64 }}>
          {[
            { value: "25,000+", label: "agents scored" },
            { value: "5", label: "chains indexed" },
            { value: "15", label: "MCP tools" },
            { value: "11", label: "AI agents live" },
          ].map((stat) => (
            <div key={stat.label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: 36, fontWeight: 700, color: "white", fontFamily: "monospace" }}>
                {stat.value}
              </span>
              <span style={{ fontSize: 14, color: "#6B7280", fontFamily: "monospace" }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 80,
            background: "#0D0D14",
            borderTop: "1px solid #1F2937",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 13, fontFamily: "monospace", color: "#4B5563" }}>
            AVALANCHE · ETHEREUM · BASE · LINEA
          </span>
          <span style={{ fontSize: 16, fontFamily: "monospace", color: "#34D399", opacity: 0.7 }}>
            agentproof.sh
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}

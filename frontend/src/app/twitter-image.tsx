import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";
export const alt = "AgentProof — Trust Oracle for the ERC-8004 Agent Economy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0A0A0F 0%, #0F1118 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
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
            background:
              "radial-gradient(ellipse, rgba(0,229,160,0.1) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Shield + Title */}
        <div
          style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 16 }}
        >
          <svg
            width="64"
            height="64"
            viewBox="0 0 32 32"
            fill="none"
          >
            <path
              d="M16 4L6 9.5V16C6 22.63 10.27 28.79 16 30C21.73 28.79 26 22.63 26 16V9.5L16 4Z"
              stroke="#00E5A0"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M12 16.5L14.5 19L20 13"
              stroke="#00E5A0"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 800 }}>
            <span style={{ color: "white" }}>Agent</span>
            <span style={{ color: "#00E5A0" }}>Proof</span>
          </div>
        </div>

        {/* ERC-8004 badge */}
        <div
          style={{
            display: "flex",
            padding: "6px 16px",
            border: "1px solid rgba(0,229,160,0.3)",
            background: "rgba(0,229,160,0.06)",
            borderRadius: 6,
            marginBottom: 32,
          }}
        >
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 14,
              color: "#00E5A0",
              opacity: 0.8,
            }}
          >
            ERC-8004
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            color: "#8888aa",
            marginBottom: 48,
            display: "flex",
          }}
        >
          On-chain reputation oracle for AI agents
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 80 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 40,
                fontWeight: 700,
                color: "white",
              }}
            >
              51,700+
            </span>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 14,
                color: "#6B7280",
                marginTop: 4,
              }}
            >
              agents scored
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 40,
                fontWeight: 700,
                color: "white",
              }}
            >
              21
            </span>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 14,
                color: "#6B7280",
                marginTop: 4,
              }}
            >
              chains indexed
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 40,
                fontWeight: 700,
                color: "white",
              }}
            >
              153K+
            </span>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 14,
                color: "#6B7280",
                marginTop: 4,
              }}
            >
              evaluations
            </span>
          </div>
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
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 13,
              color: "#4B5563",
            }}
          >
            AVALANCHE · ETHEREUM · BASE · ARBITRUM · OPTIMISM · POLYGON · LINEA
          </span>
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 16,
              color: "#00E5A0",
              opacity: 0.7,
            }}
          >
            agentproof.sh
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}

"use client";

/**
 * DeployerStorm — live canvas visualisation of AI agent deployer clusters.
 *
 * Shows agent nodes colored by trust tier, grouped into deployer clusters
 * with orbital rings colored by deployer wallet age. Inspired by RNWY's
 * "Sock Puppet Storm" but showing deployer fingerprints.
 *
 * Placement: full-width section on homepage, below hero/stats.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ── Colors ──────────────────────────────────────────────────────

const TIER_COLORS = {
  high: "#00ff88",
  medium: "#ffaa00",
  flagged: "#ff3344",
};

// Deployer wallet age → ring color
const AGE_COLORS = [
  { label: "Same day", color: "#ff3344", maxDays: 1 },
  { label: "1-7 days", color: "#ff8844", maxDays: 7 },
  { label: "1-4 weeks", color: "#ffcc00", maxDays: 28 },
  { label: "1-12 months", color: "#00ccaa", maxDays: 365 },
  { label: "1+ year", color: "#8866ff", maxDays: Infinity },
];

function ageToColor(days: number): string {
  for (const a of AGE_COLORS) {
    if (days <= a.maxDays) return a.color;
  }
  return AGE_COLORS[AGE_COLORS.length - 1].color;
}

const CHAIN_BADGES: Record<string, string> = {
  avalanche: "A",
  base: "B",
  linea: "L",
  optimism: "O",
  ethereum: "E",
  polygon: "P",
  arbitrum: "R",
};

// ── Types ───────────────────────────────────────────────────────

interface AgentNode {
  id: string;
  address: string;
  score: number;
  tier: "high" | "medium" | "flagged";
  chain: string;
  deployerAge: number; // days
  flagCount: number;
  clusterId: number | null;
  // Position + velocity
  x: number;
  y: number;
  vx: number;
  vy: number;
  // For clustered nodes: orbital angle + radius
  angle: number;
  orbitRadius: number;
  orbitSpeed: number;
}

interface Cluster {
  id: number;
  cx: number;
  cy: number;
  agentCount: number;
  deployerAge: number;
  ringRadius: number;
  pulsePhase: number;
}

// ── Mock Data ───────────────────────────────────────────────────
// MOCK — replace with API call

function randomAddr(): string {
  const hex = "0123456789abcdef";
  let s = "0x";
  for (let i = 0; i < 40; i++) s += hex[Math.floor(Math.random() * 16)];
  return s;
}

function generateMockData(nodeCount: number) {
  const chains = ["avalanche", "base", "linea", "optimism", "ethereum"];
  const clusters: Cluster[] = [];
  const agents: AgentNode[] = [];

  // Create ~15 clusters
  const clusterCount = Math.max(8, Math.floor(nodeCount * 0.18));
  for (let i = 0; i < clusterCount; i++) {
    const agentCount = 3 + Math.floor(Math.random() * 6);
    clusters.push({
      id: i,
      cx: 0.15 + Math.random() * 0.7,
      cy: 0.15 + Math.random() * 0.7,
      agentCount,
      deployerAge: Math.random() < 0.3 ? Math.floor(Math.random() * 7) : Math.floor(Math.random() * 500),
      ringRadius: 30 + agentCount * 8,
      pulsePhase: Math.random() * Math.PI * 2,
    });
  }

  let nodeId = 0;

  // Create clustered agents
  for (const cluster of clusters) {
    for (let j = 0; j < cluster.agentCount; j++) {
      const score = Math.random() * 100;
      const tier: AgentNode["tier"] = score >= 70 ? "high" : score >= 40 ? "medium" : "flagged";
      const angle = (j / cluster.agentCount) * Math.PI * 2 + Math.random() * 0.3;
      agents.push({
        id: `agent-${nodeId++}`,
        address: randomAddr(),
        score: Math.round(score * 10) / 10,
        tier,
        chain: chains[Math.floor(Math.random() * chains.length)],
        deployerAge: cluster.deployerAge + Math.floor(Math.random() * 3),
        flagCount: tier === "flagged" ? 1 + Math.floor(Math.random() * 4) : 0,
        clusterId: cluster.id,
        x: 0, y: 0, vx: 0, vy: 0,
        angle,
        orbitRadius: cluster.ringRadius * (0.7 + Math.random() * 0.6),
        orbitSpeed: 0.002 + Math.random() * 0.004,
      });
    }
  }

  // Create solo agents
  const soloCount = nodeCount - agents.length;
  for (let i = 0; i < soloCount; i++) {
    const score = Math.random() * 100;
    const tier: AgentNode["tier"] = score >= 70 ? "high" : score >= 40 ? "medium" : "flagged";
    agents.push({
      id: `agent-${nodeId++}`,
      address: randomAddr(),
      score: Math.round(score * 10) / 10,
      tier,
      chain: chains[Math.floor(Math.random() * chains.length)],
      deployerAge: Math.floor(Math.random() * 600),
      flagCount: tier === "flagged" ? 1 + Math.floor(Math.random() * 3) : 0,
      clusterId: null,
      x: 0.05 + Math.random() * 0.9,
      y: 0.05 + Math.random() * 0.9,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      angle: 0,
      orbitRadius: 0,
      orbitSpeed: 0,
    });
  }

  return { agents, clusters };
}

// ── Component ───────────────────────────────────────────────────

export default function DeployerStorm() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<{ agents: AgentNode[]; clusters: Cluster[] } | null>(null);
  const mouseRef = useRef({ x: -1, y: -1 });
  const hoveredRef = useRef<AgentNode | null>(null);
  const [hovered, setHovered] = useState<AgentNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const frameRef = useRef(0);
  const timeRef = useRef(0);
  const router = useRouter();

  // Init data
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    dataRef.current = generateMockData(isMobile ? 40 : 80);
  }, []);

  // Resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    function resize() {
      const rect = container!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      canvas!.style.width = `${rect.width}px`;
      canvas!.style.height = `${rect.height}px`;
    }

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Mouse tracking
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function onMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function onLeave() {
      mouseRef.current = { x: -1, y: -1 };
      hoveredRef.current = null;
      setHovered(null);
    }

    function onClick() {
      const agent = hoveredRef.current;
      if (agent) {
        // Click agent node → navigate to agent directory filtered by tier
        router.push(`/agents?tier=${agent.tier}`);
      }
    }

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    canvas.addEventListener("click", onClick);
    return () => {
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
      canvas.removeEventListener("click", onClick);
    };
  }, [router]);

  // Animation loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const data = dataRef.current;
    if (!canvas || !data) {
      frameRef.current = requestAnimationFrame(draw);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    timeRef.current += 0.016;
    const t = timeRef.current;
    const { agents, clusters } = data;

    // ── Draw deployer rings ─────────────────────────────
    for (const c of clusters) {
      const cx = c.cx * W;
      const cy = c.cy * H;
      const pulse = 1 + 0.08 * Math.sin(t * 1.5 + c.pulsePhase);
      const r = c.ringRadius * pulse;
      const color = ageToColor(c.deployerAge);

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = color + "30";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Subtle fill
      ctx.fillStyle = color + "08";
      ctx.fill();
    }

    // ── Update + draw agents ────────────────────────────
    let closestDist = 20;
    let closestAgent: AgentNode | null = null;
    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;

    for (const agent of agents) {
      let ax: number, ay: number;

      if (agent.clusterId !== null) {
        const c = clusters[agent.clusterId];
        agent.angle += agent.orbitSpeed;
        ax = c.cx * W + Math.cos(agent.angle) * agent.orbitRadius;
        ay = c.cy * H + Math.sin(agent.angle) * agent.orbitRadius;
      } else {
        // Brownian drift
        agent.vx += (Math.random() - 0.5) * 0.02;
        agent.vy += (Math.random() - 0.5) * 0.02;
        agent.vx *= 0.98;
        agent.vy *= 0.98;
        agent.x += agent.vx * 0.016;
        agent.y += agent.vy * 0.016;
        // Bounce at edges
        if (agent.x < 0.02 || agent.x > 0.98) agent.vx *= -1;
        if (agent.y < 0.02 || agent.y > 0.98) agent.vy *= -1;
        agent.x = Math.max(0.02, Math.min(0.98, agent.x));
        agent.y = Math.max(0.02, Math.min(0.98, agent.y));
        ax = agent.x * W;
        ay = agent.y * H;
      }

      const color = TIER_COLORS[agent.tier];
      const nodeRadius = agent.tier === "flagged" ? 5 : 4;

      // Flagged pulse
      let alpha = "cc";
      if (agent.tier === "flagged") {
        const pulse = 0.5 + 0.5 * Math.sin(t * 3 + parseInt(agent.id.slice(-3), 10));
        alpha = Math.round(140 + pulse * 115).toString(16).padStart(2, "0");
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(ax, ay, nodeRadius, 0, Math.PI * 2);
      ctx.fillStyle = color + alpha;
      ctx.fill();

      // Glow
      ctx.beginPath();
      ctx.arc(ax, ay, nodeRadius + 3, 0, Math.PI * 2);
      ctx.fillStyle = color + "15";
      ctx.fill();

      // Chain badge
      const badge = CHAIN_BADGES[agent.chain] || "?";
      ctx.font = "7px JetBrains Mono, monospace";
      ctx.fillStyle = "#ffffff80";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(badge, ax, ay + nodeRadius + 9);

      // Hit test for tooltip
      if (mx >= 0) {
        const dx = ax - mx;
        const dy = ay - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          closestAgent = agent;
          setTooltipPos({ x: ax, y: ay });
        }
      }
    }

    // Update hover
    if (closestAgent !== hoveredRef.current) {
      hoveredRef.current = closestAgent;
      setHovered(closestAgent);
    }

    frameRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw]);

  // ── Stats ─────────────────────────────────────────────
  const data = dataRef.current;
  const clusteredCount = data ? data.agents.filter((a) => a.clusterId !== null).length : 0;
  const total = data ? data.agents.length : 0;
  const zeroHistory = data ? data.clusters.filter((c) => c.deployerAge <= 1).length : 0;
  const totalClusters = data ? data.clusters.length : 0;
  const flaggedCount = data ? data.agents.filter((a) => a.tier === "flagged").length : 0;

  return (
    <div className="relative" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="w-full h-[500px] md:h-[600px] cursor-crosshair"
      />

      {/* Stat counters — top right */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 text-right">
        <div>
          <span className="text-2xl font-mono font-bold text-white">
            {total > 0 ? Math.round((clusteredCount / total) * 100) : 0}%
          </span>
          <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Shared Deployer</p>
        </div>
        <div>
          <span className="text-2xl font-mono font-bold text-[#ff3344]">
            {totalClusters > 0 ? Math.round((zeroHistory / totalClusters) * 100) : 0}%
          </span>
          <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Zero-History Deployers</p>
        </div>
        <div>
          <span className="text-2xl font-mono font-bold text-[#ffaa00]">
            {flaggedCount}
          </span>
          <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Flagged Agents</p>
        </div>
      </div>

      {/* Legend — bottom */}
      <div className="absolute bottom-4 left-4 flex items-center gap-3">
        {AGE_COLORS.map((a) => (
          <div key={a.label} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: a.color, boxShadow: `0 0 6px ${a.color}40` }}
            />
            <span className="text-[9px] font-mono text-gray-500">{a.label}</span>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {hovered && (
        <div
          className="absolute pointer-events-none bg-[#111118] border border-[#2a2a3a] rounded-lg px-3 py-2 text-xs font-mono z-10"
          style={{
            left: Math.min(tooltipPos.x + 12, (containerRef.current?.clientWidth || 600) - 200),
            top: tooltipPos.y - 60,
          }}
        >
          <p className="text-white truncate max-w-[180px]">{hovered.address.slice(0, 6)}...{hovered.address.slice(-4)}</p>
          <p className="text-gray-400">
            Score: <span style={{ color: TIER_COLORS[hovered.tier] }}>{hovered.score}</span>
          </p>
          <p className="text-gray-400">
            Chain: <span className="text-white">{hovered.chain}</span>
          </p>
          <p className="text-gray-400">
            Deployer age: <span className="text-white">{hovered.deployerAge}d</span>
          </p>
          {hovered.flagCount > 0 && (
            <p className="text-[#ff3344]">{hovered.flagCount} flag{hovered.flagCount > 1 ? "s" : ""}</p>
          )}
          <p className="text-gray-600 mt-1 text-[9px]">Click to view agents</p>
        </div>
      )}
    </div>
  );
}

import type { MetadataRoute } from "next";

const BASE = "https://agentproof.sh";

// Static pages with their priority and change frequency
const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"] }[] = [
  { path: "/", priority: 1.0, changeFrequency: "daily" },
  { path: "/agents", priority: 0.9, changeFrequency: "hourly" },
  { path: "/discover", priority: 0.9, changeFrequency: "hourly" },
  { path: "/leaderboard", priority: 0.9, changeFrequency: "hourly" },
  { path: "/evidence", priority: 0.8, changeFrequency: "weekly" },
  { path: "/whitepaper", priority: 0.8, changeFrequency: "monthly" },
  { path: "/docs", priority: 0.8, changeFrequency: "weekly" },
  { path: "/pricing", priority: 0.7, changeFrequency: "monthly" },
  { path: "/register", priority: 0.7, changeFrequency: "monthly" },
  { path: "/badges", priority: 0.6, changeFrequency: "monthly" },
  { path: "/mcp", priority: 0.7, changeFrequency: "monthly" },
  { path: "/marketplace", priority: 0.7, changeFrequency: "daily" },
  { path: "/insurance", priority: 0.6, changeFrequency: "daily" },
  { path: "/payments", priority: 0.6, changeFrequency: "daily" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Static routes
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${BASE}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // Dynamic agent pages — fetch top agents from the backend
  // We include the top 1000 agents by score for SEO (most valuable long-tail pages)
  let agentEntries: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(
      "https://agentproof-production.up.railway.app/api/discover/search?sort=score&page_size=100&page=1",
      { next: { revalidate: 86400 } } // revalidate daily
    );
    if (res.ok) {
      const data = await res.json();
      agentEntries = (data.agents || []).map((agent: { agent_id: number; source_chain?: string; updated_at?: string }) => ({
        url: `${BASE}/agents/${agent.agent_id}${agent.source_chain ? `?chain=${agent.source_chain}` : ""}`,
        lastModified: agent.updated_at ? new Date(agent.updated_at) : now,
        changeFrequency: "daily" as const,
        priority: 0.5,
      }));
    }
  } catch {
    // If API is down, just return static routes
  }

  return [...staticEntries, ...agentEntries];
}

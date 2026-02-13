const INTELLIGENCE_API =
  (process.env.NEXT_PUBLIC_INTELLIGENCE_API_URL || "https://agent-eco-system-production.up.railway.app").trim();

const INTELLIGENCE_API_KEY =
  (process.env.NEXT_PUBLIC_INTELLIGENCE_API_KEY || "7pFq9wCbWAswNKPKFuieXsosVBGnwm-hNqYHBYZ6VZs").trim();

interface FetchOptions {
  params?: Record<string, string | number | undefined>;
}

export async function intelligenceFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { params } = options;

  let url = `${INTELLIGENCE_API}${endpoint}`;

  if (params) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    }
    const qs = sp.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {};
  if (INTELLIGENCE_API_KEY) {
    headers["x-api-key"] = INTELLIGENCE_API_KEY;
  }

  const res = await fetch(url, { headers, next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`Intelligence API ${res.status}`);
  return res.json();
}

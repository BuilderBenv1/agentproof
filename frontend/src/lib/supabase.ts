import { API_URL, BACKEND_URL } from "./constants";

interface FetchOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number | undefined>;
}

function buildUrl(base: string, endpoint: string, params?: FetchOptions["params"]): string {
  const normalizedBase = base.replace(/\/api\/?$/, "");
  const path = endpoint.startsWith("/api") ? endpoint : `/api${endpoint}`;
  let url = `${normalizedBase}${path}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.set(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  return url;
}

async function doFetch<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const { method = "GET", body } = options;

  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "Unknown error");
    throw new Error(`API error ${res.status}: ${errorBody}`);
  }

  return res.json();
}

/** Fetch from the Oracle API (trust scores, risk, badges, network stats) */
export async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const url = buildUrl(API_URL, endpoint, options.params);
  return doFetch<T>(url, options);
}

/** Fetch from the Backend API (agents, leaderboard, analytics, marketplace, monitoring) */
export async function backendFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const url = buildUrl(BACKEND_URL, endpoint, options.params);
  return doFetch<T>(url, options);
}

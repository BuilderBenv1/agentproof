import { API_URL } from "./constants";

interface FetchOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number | undefined>;
}

export async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { method = "GET", body, params } = options;

  // Normalize: strip /api from base URL, then ensure endpoint starts with /api
  const base = API_URL.replace(/\/api\/?$/, "");
  const path = endpoint.startsWith("/api") ? endpoint : `/api${endpoint}`;
  let url = `${base}${path}`;

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

  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    next: { revalidate: 30 },
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "Unknown error");
    throw new Error(`API error ${res.status}: ${errorBody}`);
  }

  return res.json();
}

const apiBaseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const adminKey = (import.meta.env.VITE_ADMIN_API_KEY || "").trim();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(init?.headers || {}),
  };
  if (adminKey) {
    (headers as Record<string, string>)["X-Admin-Key"] = adminKey;
  }
  const res = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = (body as { detail?: string }).detail || res.statusText;
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export type GameStatus = {
  guild_id: number;
  week_key: string;
  selection_week_key: string;
  cycle: Record<string, unknown>;
  ticker_counts: Record<string, number>;
  ticker_limit: number;
  vote_entry_counts: Record<string, number>;
  category_titles: Record<string, string>;
  latest_winners: { week_key: string; winner_ids: number[] } | null;
  bot_connected: boolean;
};

export const api = {
  health: () => request<{ status: string }>("/api/health"),
  status: () => request<GameStatus>("/api/game/status"),
  tickers: () =>
    request<{ week_key: string; picks: unknown[]; by_category: Record<string, string[]> }>(
      "/api/game/tickers"
    ),
  votes: () =>
    request<{ week_key: string; counts: Record<string, { ticker: string; votes: number }[]> }>(
      "/api/game/votes"
    ),
  leaderboards: () =>
    request<{
      week_key: string;
      leaderboards: Record<
        string,
        { rank: number; ticker: string; votes: number; name: string; quote: string }[]
      >;
      category_titles: Record<string, string>;
    }>("/api/game/leaderboards"),
  audit: (limit = 50) => request<Record<string, unknown>[]>(`/api/game/audit?limit=${limit}`),
  subscriptions: (limit = 100) =>
    request<Record<string, unknown>[]>(`/api/subscriptions?limit=${limit}`),
  action: (name: string, actorId?: number) =>
    request<{ ok: boolean; message: string }>(`/api/game/actions/${name}`, {
      method: "POST",
      body: JSON.stringify(actorId != null ? { actor_id: actorId } : {}),
    }),
};

export function isApiConfigured(): boolean {
  return Boolean(adminKey);
}

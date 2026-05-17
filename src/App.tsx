import { useCallback, useEffect, useState } from "react";
import { api, isApiConfigured, type GameStatus } from "./api";

const CATS = ["small", "mid", "blue"] as const;
type Cat = (typeof CATS)[number];

const CAT_CLASS: Record<Cat, string> = {
  small: "cat-small",
  mid: "cat-mid",
  blue: "cat-blue",
};

const ACTIONS: { id: string; label: string; variant?: "danger" }[] = [
  { id: "start_pre_voting", label: "Pre-vote" },
  { id: "end_pre_start_voting", label: "End pre → Vote" },
  { id: "start_voting", label: "Open vote" },
  { id: "close_early", label: "Close early" },
  { id: "end_competition", label: "End week", variant: "danger" },
];

type LbRow = {
  rank: number;
  ticker: string;
  votes: number;
  name: string;
  quote: string;
};

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function App() {
  const [status, setStatus] = useState<GameStatus | null>(null);
  const [tickers, setTickers] = useState<Record<string, string[]>>({});
  const [leaderboards, setLeaderboards] = useState<Record<string, LbRow[]>>({});
  const [audit, setAudit] = useState<Record<string, unknown>[]>([]);
  const [subs, setSubs] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

  const refresh = useCallback(async () => {
    if (!isApiConfigured()) {
      setError("Add VITE_ADMIN_API_KEY to crm/.env.local");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [s, t, lb, a, sub] = await Promise.all([
        api.status(),
        api.tickers(),
        api.leaderboards(),
        api.audit(30),
        api.subscriptions(40),
      ]);
      setStatus(s);
      setTickers(t.by_category);
      setLeaderboards(lb.leaderboards);
      setAudit(a);
      setSubs(sub);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      if (
        msg.includes("Failed to fetch") ||
        msg.includes("ECONNREFUSED") ||
        msg.includes("NetworkError")
      ) {
        setError("Server offline — run: cd server && python run.py");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const runAction = async (actionId: string) => {
    if (!confirm(`Run "${actionId}" on the live Discord game?`)) return;
    setLoading(true);
    try {
      const res = await api.action(actionId);
      showToast(res.message);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setLoading(false);
    }
  };

  const cycle = status?.cycle as Record<string, boolean | string> | undefined;
  const phase = (cycle?.status as string) || "—";
  const limit = status?.ticker_limit ?? 20;

  return (
    <div className="dashboard">
      {loading && (
        <div className="loading-overlay">
          <div className="spinner" />
        </div>
      )}

      <header className="header">
        <div className="brand">
          <div className="brand-icon">MS</div>
          <div>
            <h1>Meme Stock</h1>
            <p>Weekly game control</p>
          </div>
        </div>
        <div className="header-meta">
          {status && (
            <>
              <span className="pill mono">{status.week_key}</span>
              <span className="pill pill-phase">{phase}</span>
              {cycle?.voting_open && <span className="pill">Voting open</span>}
              {cycle?.ticker_selection_open && <span className="pill">Picks open</span>}
              <span className={`pill ${status.bot_connected ? "pill-live" : "pill-dead"}`}>
                {status.bot_connected ? "Bot online" : "Bot offline"}
              </span>
            </>
          )}
          <button type="button" className="btn btn-ghost" disabled={loading} onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
      </header>

      {error && <div className="alert">{error}</div>}

      <div className="main-grid">
        <div className="controls-row">
          <div className="stats-strip">
            {CATS.map((cat) => {
              const n = status?.ticker_counts[cat] ?? 0;
              const pct = Math.min(100, (n / limit) * 100);
              const title = status?.category_titles[cat] ?? cat;
              return (
                <div key={cat} className={`stat-card ${CAT_CLASS[cat]}`}>
                  <h4>{title}</h4>
                  <div className="count">
                    {n}
                    <span style={{ color: "var(--muted)", fontSize: "0.9rem", fontWeight: 500 }}>
                      /{limit}
                    </span>
                  </div>
                  <div className="bar">
                    <div className="bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="actions-panel">
            <h4>Game controls</h4>
            <div className="actions-grid">
              {ACTIONS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`btn btn-sm ${a.variant === "danger" ? "btn-danger" : "btn-accent"}`}
                  disabled={loading}
                  onClick={() => void runAction(a.id)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="categories-row">
          {CATS.map((cat) => (
            <CategoryColumn
              key={cat}
              cat={cat}
              title={status?.category_titles[cat] ?? cat}
              tickers={tickers[cat] ?? []}
              leaderboard={leaderboards[cat] ?? []}
              limit={limit}
            />
          ))}
        </div>

        <div className="bottom-row">
          <div className="bottom-panel">
            <h4>Recent activity</h4>
            <div className="bottom-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Event</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="empty-hint">
                        No events
                      </td>
                    </tr>
                  ) : (
                    audit.map((row, i) => (
                      <tr key={i}>
                        <td className="mono">{formatTime(String(row.created_at || ""))}</td>
                        <td>{String(row.event_type || "")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bottom-panel">
            <h4>Subscriptions</h4>
            <div className="bottom-scroll">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="empty-hint">
                        No subscribers
                      </td>
                    </tr>
                  ) : (
                    subs.map((row, i) => (
                      <tr key={i}>
                        <td className="mono">{String(row.discord_id || "")}</td>
                        <td>{String(row.status || "")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {status?.latest_winners && (
              <div className="winners-bar">
                Last winners ({status.latest_winners.week_key}):{" "}
                <span className="mono">{status.latest_winners.winner_ids.join(", ") || "—"}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function CategoryColumn({
  cat,
  title,
  tickers,
  leaderboard,
  limit,
}: {
  cat: Cat;
  title: string;
  tickers: string[];
  leaderboard: LbRow[];
  limit: number;
}) {
  return (
    <article className={`category-panel ${CAT_CLASS[cat]}`}>
      <div className="category-header">
        <h3 className={CAT_CLASS[cat]}>{title}</h3>
        <span className="count-badge">
          {tickers.length}/{limit} tickers · {leaderboard.length} voted
        </span>
      </div>
      <div className="category-body">
        <div>
          <div className="section-label">Ballot</div>
          <div className="ticker-scroll">
            {tickers.length === 0 ? (
              <span className="empty-hint">No tickers yet</span>
            ) : (
              tickers.map((t) => (
                <span key={t} className="ticker-chip">
                  ${t}
                </span>
              ))
            )}
          </div>
        </div>
        <div>
          <div className="section-label">Live votes</div>
          <div className="leader-scroll">
            {leaderboard.length === 0 ? (
              <p className="empty-hint">No votes yet</p>
            ) : (
              leaderboard.map((row) => (
                <div key={row.ticker} className="lb-row">
                  <span className={`lb-rank ${row.rank <= 3 ? "top" : ""}`}>{row.rank}</span>
                  <div>
                    <div className="lb-ticker">${row.ticker}</div>
                    <div className="lb-meta">
                      {row.name || "—"} · {row.quote}
                    </div>
                  </div>
                  <span className="lb-votes">{row.votes}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

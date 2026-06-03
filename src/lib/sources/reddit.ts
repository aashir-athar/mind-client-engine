// Reddit official API connector — free non-commercial OAuth "script" app.
// Entirely OPTIONAL: when REDDIT_* env vars are unset, every call returns
// gracefully with configured:false. Mandatory User-Agent format is enforced.
import { config } from "../config";
import type { DiscoveredLead } from "./types";

let cachedToken: { token: string; expiresAt: number } | null = null;

export function redditConfigured(): boolean {
  return !!(
    config.REDDIT_CLIENT_ID &&
    config.REDDIT_CLIENT_SECRET &&
    config.REDDIT_USERNAME &&
    config.REDDIT_PASSWORD
  );
}

function redditUA(): string {
  return config.REDDIT_USER_AGENT || "web:mind-client-engine:0.1 (by /u/unknown)";
}

async function getToken(): Promise<string | null> {
  if (!redditConfigured()) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token;

  const basic = Buffer.from(
    `${config.REDDIT_CLIENT_ID}:${config.REDDIT_CLIENT_SECRET}`,
  ).toString("base64");
  const body = new URLSearchParams({
    grant_type: "password",
    username: config.REDDIT_USERNAME!,
    password: config.REDDIT_PASSWORD!,
  });

  try {
    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": redditUA(),
      },
      body: body.toString(),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!j.access_token) return null;
    cachedToken = { token: j.access_token, expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000 };
    return cachedToken.token;
  } catch {
    return null;
  }
}

interface RedditChild {
  data?: { title?: string; selftext?: string; author?: string; permalink?: string };
}

/** Pure mapping of a Reddit search child → DiscoveredLead. */
export function mapRedditChild(child: RedditChild): DiscoveredLead | null {
  const d = child?.data;
  if (!d) return null;
  const title = (d.title ?? "").trim();
  const self = (d.selftext ?? "").trim();
  if (!title) return null;
  return {
    businessName: title.slice(0, 90),
    contactName: d.author ? `u/${d.author}` : null,
    sourceType: "REDDIT",
    sourceUrl: d.permalink ? `https://www.reddit.com${d.permalink}` : null,
    painPoint: title,
    rawText: `${title} ${self}`.trim(),
  };
}

export async function searchReddit(input: {
  query: string;
  subreddit?: string;
  limit?: number;
}): Promise<{ leads: DiscoveredLead[]; configured: boolean; note?: string }> {
  if (!redditConfigured()) {
    return { leads: [], configured: false, note: "Reddit not configured (set REDDIT_* in .env.local)." };
  }
  const token = await getToken();
  if (!token) return { leads: [], configured: true, note: "Reddit auth failed (check credentials)." };

  const base = input.subreddit
    ? `https://oauth.reddit.com/r/${input.subreddit}/search`
    : "https://oauth.reddit.com/search";
  const qs = new URLSearchParams({
    q: input.query,
    sort: "new",
    limit: String(input.limit ?? 25),
    ...(input.subreddit ? { restrict_sr: "1" } : {}),
  });

  try {
    const res = await fetch(`${base}?${qs.toString()}`, {
      headers: { Authorization: `bearer ${token}`, "User-Agent": redditUA() },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { leads: [], configured: true, note: `Reddit search error ${res.status}` };
    const j = (await res.json()) as { data?: { children?: RedditChild[] } };
    const leads = (j.data?.children ?? [])
      .map(mapRedditChild)
      .filter((x): x is DiscoveredLead => x !== null);
    return { leads, configured: true };
  } catch (err) {
    return {
      leads: [],
      configured: true,
      note: `Reddit fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

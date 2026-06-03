// RSS / job-feed connector. Parses a configurable list of public feeds and keeps
// only items that show buying intent (keyword match). Feeds are plain public URLs
// (no key). Default set is verified-live (We Work Remotely, Remotive, HN hiring).
import Parser from "rss-parser";
import { config } from "../config";
import { matchKeywords, matchService } from "../keywords";
import type { DiscoveredLead } from "./types";

const DEFAULT_FEEDS = [
  "https://weworkremotely.com/remote-jobs.rss",
  "https://remotive.com/remote-jobs/feed",
  "https://hnrss.org/whoishiring/jobs",
];

function feedList(): string[] {
  if (config.RSS_FEEDS) {
    return config.RSS_FEEDS.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return DEFAULT_FEEDS;
}

const parser = new Parser({ headers: { "User-Agent": config.USER_AGENT }, timeout: 15000 });

interface FeedItem {
  title?: string;
  link?: string;
  contentSnippet?: string;
  content?: string;
}

/** Pure mapping of a feed item → DiscoveredLead. */
export function feedItemToLead(item: FeedItem, feedTitle?: string): DiscoveredLead {
  const title = (item.title ?? "Untitled").trim();
  const body = item.contentSnippet ?? item.content ?? "";
  return {
    businessName: title.slice(0, 90),
    sourceType: "RSS",
    sourceUrl: item.link ?? null,
    industry: feedTitle ?? null,
    painPoint: title,
    rawText: `${title} ${body}`.trim(),
  };
}

export async function discoverFromRss(input?: {
  feeds?: string[];
  limitPerFeed?: number;
}): Promise<{ leads: DiscoveredLead[]; scanned: number; note?: string }> {
  const feeds = input?.feeds?.length ? input.feeds : feedList();
  const leads: DiscoveredLead[] = [];
  const notes: string[] = [];
  let scanned = 0;

  for (const url of feeds) {
    try {
      const feed = await parser.parseURL(url);
      const items = (feed.items ?? []).slice(0, input?.limitPerFeed ?? 40) as FeedItem[];
      for (const item of items) {
        scanned++;
        const text = `${item.title ?? ""} ${item.contentSnippet ?? ""}`;
        // Job feeds list ROLES (e.g. "React Native Developer"), so match on a
        // service we offer OR a buying-intent keyword.
        if (matchService(text) === null && matchKeywords(text).length === 0) continue;
        leads.push(feedItemToLead(item, feed.title));
      }
    } catch (err) {
      notes.push(`${url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { leads, scanned, note: notes.length ? notes.join("; ") : undefined };
}

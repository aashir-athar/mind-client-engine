import { manualSearchLinks, redditConfigured } from "@/lib/sources";
import type { SearchParamsObj } from "@/lib/ui";
import { ingestPaste, runOverpass, runReddit, runRss } from "./actions";

export const dynamic = "force-dynamic";

export default async function SourcesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsObj>;
}) {
  const sp = await searchParams;
  const err = typeof sp.err === "string" ? sp.err : "";
  const links = manualSearchLinks();
  const redditOn = redditConfigured();

  return (
    <>
      <h1 className="page-title">Discover leads</h1>
      <p className="page-sub">
        Free, legitimate sources only. Automated channels read public data politely; ToS-restricted
        platforms use Paste-&amp;-Enrich (no scraping).
      </p>

      {err && (
        <div className="section" style={{ borderColor: "var(--red)" }}>
          <strong style={{ color: "var(--red)" }}>{err}</strong>
        </div>
      )}

      <div className="detail-grid">
        <div>
          {/* Paste & Enrich */}
          <div className="section">
            <h3>Paste &amp; Enrich</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Paste a LinkedIn / Instagram / X / Upwork URL and/or the text of a post. We parse,
              match a service, score it, and create a lead — never scrape.
            </p>
            <form action={ingestPaste} className="stack">
              <input type="text" name="url" placeholder="Profile or post URL (optional)" />
              <textarea name="text" placeholder="Paste the post / bio / message text (optional)" />
              <div>
                <button className="btn" type="submit">
                  Enrich &amp; create lead
                </button>
              </div>
            </form>
          </div>

          {/* Automated discovery */}
          <div className="section">
            <h3>Local businesses (OpenStreetMap)</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Keyless Overpass + Nominatim. Data © OpenStreetMap contributors (ODbL).
            </p>
            <form action={runOverpass} className="filters" style={{ marginBottom: 0 }}>
              <div className="field">
                <label>City</label>
                <input type="text" name="city" defaultValue="Lahore" />
              </div>
              <div className="field">
                <label>Category</label>
                <input type="text" name="category" defaultValue="cafe" placeholder="cafe, bakery, gym…" />
              </div>
              <button className="btn" type="submit">
                Discover
              </button>
            </form>
          </div>

          <div className="section">
            <h3>Job / hiring feeds (RSS)</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Scans We Work Remotely, Remotive, and HN “who is hiring”, keeping only buying-intent
              items (configurable via <code>RSS_FEEDS</code>).
            </p>
            <form action={runRss}>
              <button className="btn" type="submit">
                Scan feeds
              </button>
            </form>
          </div>

          <div className="section">
            <h3>Reddit</h3>
            {redditOn ? (
              <form action={runReddit} className="filters" style={{ marginBottom: 0 }}>
                <div className="field">
                  <label>Search query</label>
                  <input type="text" name="query" defaultValue="need a react native developer" />
                </div>
                <button className="btn" type="submit">
                  Search
                </button>
              </form>
            ) : (
              <p className="muted" style={{ marginTop: 0 }}>
                Not configured. Create a free Reddit “script” app and set <code>REDDIT_CLIENT_ID</code>,
                <code>REDDIT_CLIENT_SECRET</code>, <code>REDDIT_USERNAME</code>,{" "}
                <code>REDDIT_PASSWORD</code> in <code>.env.local</code> to enable it.
              </p>
            )}
          </div>
        </div>

        {/* Manual searches */}
        <div>
          <div className="section">
            <h3>Manual search links</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Open these yourself, then paste promising results above. ToS-safe — no automation.
            </p>
            <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {links.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noreferrer">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

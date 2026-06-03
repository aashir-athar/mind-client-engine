// Ready-to-run MANUAL search links. These are just URLs the user opens themselves
// in a browser — no automation, fully ToS-safe — to find leads on platforms we
// must not scrape. Paste promising results back via Paste-&-Enrich.
export interface SearchLink {
  label: string;
  url: string;
}

export function manualSearchLinks(location = "Lahore"): SearchLink[] {
  const q = (s: string) => encodeURIComponent(s);
  return [
    {
      label: `Google — ${location} businesses with weak/no website`,
      url: `https://www.google.com/search?q=${q(`${location} small business -site:facebook.com "no website"`)}`,
    },
    {
      label: "Reddit — people needing a developer",
      url: `https://www.reddit.com/search/?q=${q("need a developer OR react native developer OR mvp")}&sort=new`,
    },
    {
      label: "LinkedIn — 'looking for developer' posts",
      url: `https://www.linkedin.com/search/results/content/?keywords=${q("looking for react native developer")}`,
    },
    {
      label: "Upwork — React Native / Expo jobs",
      url: `https://www.upwork.com/nx/search/jobs/?q=${q("react native expo")}`,
    },
    {
      label: "X / Twitter — startup MVP help (live)",
      url: `https://x.com/search?q=${q("need an MVP developer OR need a landing page")}&f=live`,
    },
    {
      label: `Google — ${location} Instagram businesses needing content`,
      url: `https://www.google.com/search?q=${q(`site:instagram.com ${location} boutique OR cafe`)}`,
    },
  ];
}

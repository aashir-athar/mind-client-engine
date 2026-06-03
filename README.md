# MiND Client Engine

A **local-first, 100% free** automated business-development assistant for a freelance
developer/creator. It discovers leads, scores them, audits their websites, drafts
personalized outreach, safely automates cold email (under strict limits), schedules
follow-ups, tracks replies, and shows everything on a dashboard with a **dynamic
goal tracker**.

Runs entirely on your machine for **$0** — no paid services, no paid APIs required.

> **Status: complete (Phases 0–11).** Verified end-to-end in DRY_RUN on seed data:
> discover → score → audit → draft → "send" (logged) → follow-up scheduled + sent →
> reply logged → goal updated. Run it yourself with `npm run demo`.

---

## Core principles (enforced in code, not just docs)

- **Everything free.** No paid dependency is ever required.
- **DRY_RUN by default.** With `DRY_RUN=true` (the default) nothing is actually sent —
  outbound actions are logged to the console and written to the `AuditLog` table, and
  treated as sent so the whole pipeline can run safely. Your email reputation is never
  touched while developing.
- **Human-in-the-loop.** Only cold email is auto-sent (under hard caps + suppression +
  dedupe). Every other channel produces a **draft** you approve and send manually.
- **No ToS-violating scrapers.** LinkedIn/Instagram/X/Upwork use a *paste-&-enrich*
  workflow plus ready-made manual search links — never automation.
- **Respect robots.txt** and use only public data. All outbound fetches send a
  descriptive `User-Agent` and stay within free rate limits.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20+ (built on 24.7) | `node --version` |
| npm | 10+ (built on 11) | ships with Node |
| Ollama | latest (optional) | Free **local** LLM. Install from <https://ollama.com>, then `ollama pull llama3.2:1b`. Without it, outreach falls back to deterministic templates — the app still works. |
| VS C++ Build Tools | only if needed | `better-sqlite3` is native; Node 24 x64 usually has a prebuilt binary. If install fails, see _SQLite fallback_. |

---

## Setup

From the project root:

```powershell
npm install                       # installs deps (+ runs prisma generate)
copy .env.example .env.local      # then edit .env.local for any secrets (optional in DRY_RUN)
npm run db:migrate                # creates prisma/dev.db + applies migrations + generates client
npm run db:seed                   # loads a small, varied sample dataset
ollama pull llama3.2:1b           # optional: enables LLM-personalized drafts
```

`.env` holds committed non-secret defaults; `.env.local` (git-ignored) holds your
secrets and overrides `.env`. `.env.example` lists **every** variable.

---

## Run

```powershell
# Terminal 1 — the dashboard
npm run dev          # http://localhost:3000

# Terminal 2 — the background worker (follow-up scheduler + optional IMAP poll)
npm run worker
```

Start **both from the project root** so the relative SQLite path resolves to the same DB.

### Try the whole pipeline in one command

```powershell
npm run demo         # full DRY_RUN end-to-end demo on a throwaway lead, with a pass/fail report
npm test             # 45 unit tests (pure logic: audit, scoring, sources, outreach, email, follow-ups, replies, goal)
```

---

## Dashboard pages

- **Overview** (`/`) — KPIs (leads, hot, messages sent, replies, follow-ups, won, revenue),
  the **dynamic goal tracker** (progress, required monthly income, clients needed,
  conversion, suggested daily outreach — all computed from today's date), and this-week stats.
- **Leads** (`/leads`) — filter by status/band/source/service + search; sortable columns.
- **Lead detail** (`/leads/[id]`) — contact info, **explainable score breakdown**, website
  audit, full timeline, status/notes editing, **generate outreach**, **log a reply**, suppress.
- **Discover** (`/sources`) — Paste-&-Enrich, OSM/RSS/Reddit triggers, manual search links.
- **Outreach Queue** (`/outreach`) — approve / edit / send / discard drafts (DRY_RUN banner).
- **Replies** (`/replies`) — inbound reply log + IMAP status.
- **Settings** (`/settings`) — editable goal target/deadline; read-only env config.

---

## Modules

| Module | Where | What |
|---|---|---|
| Website Auditor | `lib/audit-analyze.ts`, `lib/audit-site.ts` | robots.txt-respecting fetch + cheerio: HTTPS, mobile viewport, page size, SEO; optional keyless PageSpeed (only if `PSI_KEY` set). |
| Scoring Engine | `lib/scoring.ts`, `lib/scoring-run.ts` | deterministic, explainable weighted rules → 0–100 + band; optional graceful LLM tie-break near band edges. |
| Lead Sources | `lib/sources/*` | Overpass + Nominatim (keyless), Reddit OAuth (optional), RSS feeds, Paste-&-Enrich; dedupe by email/domain/sourceUrl. |
| Outreach | `lib/outreach/*` | per-service/per-channel templates, LLM-personalized with template fallback; email = draft→send, other channels = draft. |
| Email Engine | `lib/email.ts`, `lib/email-policy.ts` | Nodemailer SMTP; suppression → daily cap → send window → DRY_RUN; unsubscribe footer; step-dedupe. |
| Follow-ups | `lib/followups*.ts`, `worker/` | node-cron Day 1/3/7/14; email auto-sends, others draft; stops on reply/"no"/unsubscribe. |
| Replies | `lib/replies*.ts`, `lib/imap.ts` | optional IMAP polling (own inbox) or manual log; auto-set REPLIED + cancel follow-ups; opt-out → suppress. |
| Goal Tracker | `lib/goal.ts` | dynamic from today + WON revenue; required monthly, clients needed, conversion, suggested daily outreach. |

---

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `file:./prisma/dev.db` | SQLite path (relative — run from root). |
| `DRY_RUN` | `true` | **Safety.** `true` = nothing sent. Set `false` to send real email. |
| `USER_AGENT` | `MiNDClientEngine/0.1 (+url)` | Sent on all public-data fetches. **Don't use a fake `example.com` contact — OSM/Nominatim block it.** |
| `LLM_PROVIDER` / `OLLAMA_HOST` / `OLLAMA_MODEL` | `ollama` / `127.0.0.1:11434` / `llama3.2:1b` | Local LLM (pluggable in `lib/llm.ts`). |
| `AUDIT_TIMEOUT_MS` / `PSI_KEY` | `12000` / _empty_ | Auditor fetch timeout; optional PageSpeed key. |
| `REDDIT_CLIENT_ID/SECRET/USERNAME/PASSWORD/USER_AGENT` | _empty_ | Optional Reddit source (free "script" app). |
| `RSS_FEEDS` | built-in set | Comma-separated feed URLs. |
| `SMTP_HOST/PORT/SECURE/USER/PASS/FROM` | _empty_ | Email send (only when `DRY_RUN=false`). |
| `EMAIL_DAILY_CAP` / `SEND_WINDOW_START` / `SEND_WINDOW_END` | `20` / `9` / `18` | Cold-email safety limits. |
| `IMAP_HOST/PORT/SECURE/USER/PASS` / `IMAP_POLL_MINUTES` | _empty_ / `5` | Optional reply detection. |
| `GOAL_TARGET_USD` / `GOAL_DEADLINE` | `10000` / `2027-09-30` | Goal defaults (editable on Settings). |

---

## Architecture

```
prisma/        schema.prisma (Lead, Message, FollowUpTask, AuditResult, Suppression, Settings, AuditLog),
               migrations/, seed.ts
src/app/       Next.js App Router pages + API routes (/api/health, /api/audit, /api/outreach, /api/sources/*)
src/lib/       shared business logic (db singleton, config, llm, scoring, audit, sources, outreach,
               email, followups, replies, imap, goal) — imported by BOTH the app and the worker
worker/        standalone node-cron process (follow-up scheduler + IMAP poll)
scripts/       verify-phase7/8/9 + demo-e2e (run with tsx)
test/          node:test unit tests (run with `npm test`)
```

One shared **Prisma driver-adapter singleton** (`src/lib/db.ts`) is used by both the
Next.js app and the worker. The worker loads `.env` via `@next/env` (same precedence as Next).

---

## Troubleshooting

- **Ollama not running / model not pulled** — outreach drafts fall back to deterministic
  templates (no crash). Start Ollama and `ollama pull llama3.2:1b` for LLM personalization.
- **`better-sqlite3` won't build (no VS C++ tools)** — switch to the pure-JS libSQL adapter:
  `npm install @prisma/adapter-libsql @libsql/client`, then in `src/lib/db.ts` use
  `new PrismaLibSQL({ url: process.env.DATABASE_URL })`. No other change.
- **Nominatim/Overpass return 403** — your `USER_AGENT` contains a fake `example.com`
  contact; use a real URL/email.
- **`prisma migrate dev` says "non-interactive"** — a constraint change needs confirmation;
  run it in an interactive terminal, or use `prisma db push` for local-only dev.
- **First page load is slow (~5s)** — one-time Turbopack compile of the route + generated
  Prisma client; warm requests are ~200ms. (Windows may warn the `D:` drive is "slow".)

## Security / known advisories

`npm audit` reports **5 moderate** advisories, all in **dev/build tooling** (`postcss`
via Next's build pipeline, `@prisma/dev`/`@hono/node-server` in Prisma's dev tools) — not
in the runtime request path, and this is a local single-user app. **Do not run
`npm audit fix --force`**: its only "fix" downgrades Next.js to v9 (a breaking change that
would destroy the app). These clear as Next/Prisma update their transitive deps.

## Compliance & anti-ban (enforced)

Public data only; robots.txt respected; no automation on ToS-restricted platforms; strict
daily email caps + randomized human-like delays; unsubscribe footer + suppression list
(never re-contact suppressed/"said no"/bounced); step-dedupe; full audit log of every
outbound/inbound action; human approval gate for everything except rate-limited cold email.
OSM data (Overpass/Nominatim) is ODbL — attribute it wherever you surface results.

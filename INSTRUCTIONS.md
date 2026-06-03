# MiND Client Engine — Complete Instructions

A complete, step-by-step guide to set up, run, use, and (optionally) go live with the
MiND Client Engine — a **local-first, 100% free** automated business-development
assistant. Everything runs on your machine for **$0**.

> New here? Read this top to bottom once. For a quick reference see [README.md](README.md).

---

## Table of contents

1. [What it does](#1-what-it-does)
2. [Prerequisites](#2-prerequisites)
3. [First-time setup](#3-first-time-setup)
4. [Configuration (every env var)](#4-configuration-every-env-var)
5. [Running the app + worker](#5-running-the-app--worker)
6. [The dashboard, page by page](#6-the-dashboard-page-by-page)
7. [Try the whole pipeline (demo + tests)](#7-try-the-whole-pipeline-demo--tests)
8. [Going live (sending real email)](#8-going-live-sending-real-email)
9. [Connecting reply detection (IMAP)](#9-connecting-reply-detection-imap)
10. [Optional lead sources (Reddit, PageSpeed)](#10-optional-lead-sources-reddit-pagespeed)
11. [Resetting / backing up data](#11-resetting--backing-up-data)
12. [Troubleshooting](#12-troubleshooting)
13. [Project structure](#13-project-structure)
14. [Safety & compliance](#14-safety--compliance)

---

## 1. What it does

Given your services (web/app dev, app rescue, crypto tools, video/image editing,
short-form content), it:

- **Discovers** leads from free sources (OpenStreetMap local businesses, RSS/job feeds,
  Reddit) and a **paste-&-enrich** flow for LinkedIn/Instagram/X/Upwork (no scraping).
- **Audits** a lead's website (HTTPS, mobile-friendliness, page size, SEO).
- **Scores** each lead 0–100 with explainable rules.
- **Drafts** personalized outreach per service and channel (LLM-assisted, template fallback).
- **Sends** cold email under strict caps (everything else stays a draft you approve).
- **Schedules** follow-ups (Day 1 / 3 / 7 / 14) and **stops** the moment someone replies.
- **Tracks replies** (optional IMAP or manual) and a **dynamic goal** toward your target.

**Default safety:** `DRY_RUN=true` — nothing is actually sent. Sends are logged and
recorded so you can run the whole flow risk-free.

---

## 2. Prerequisites

| Requirement | How to get it |
|---|---|
| **Node.js 20+** (built/tested on 24.7) | <https://nodejs.org> — verify with `node --version` |
| **npm 10+** | ships with Node |
| **Git** | <https://git-scm.com> |
| **Ollama** *(optional, recommended)* | Free local LLM. <https://ollama.com> — without it, drafts use deterministic templates and the app still works fully. |
| **VS C++ Build Tools** *(only if needed)* | `better-sqlite3` is a native module; Node 24 x64 usually has a prebuilt binary. If `npm install` fails to build it, see [Troubleshooting → SQLite](#12-troubleshooting). |

---

## 3. First-time setup

Run these from the project root (the folder containing `package.json`). On Windows use
PowerShell; on macOS/Linux use a terminal (replace `copy` with `cp`).

```powershell
# 1) Install dependencies (also runs "prisma generate")
npm install

# 2) Create your local env file (holds secrets; git-ignored). Optional in DRY_RUN.
copy .env.example .env.local

# 3) Create the SQLite database, apply migrations, generate the client
npm run db:migrate

# 4) Load a small, varied sample dataset (7 leads, messages, follow-ups, an audit…)
npm run db:seed

# 5) (Optional) enable LLM-personalized drafts — pull the small local model once
ollama pull llama3.2:1b
```

That's it. You now have a working local install.

---

## 4. Configuration (every env var)

There are two env files at the project **root**:

- **`.env`** — committed, safe **non-secret defaults** (DB path, DRY_RUN, LLM, goal).
- **`.env.local`** — git-ignored; put your **secrets** here. It overrides `.env`.

Copy `.env.example` → `.env.local` and fill in only what you need.

| Variable | Default | What it does |
|---|---|---|
| `DATABASE_URL` | `file:./prisma/dev.db` | SQLite file (relative — always run from the project root). |
| `DRY_RUN` | `true` | **The master safety switch.** `true` = nothing is sent. Set `false` to send real email. |
| `USER_AGENT` | `MiNDClientEngine/0.1 (+url)` | Sent on every public-data fetch. **Use a real URL or email — OSM/Nominatim block a fake `example.com` contact.** |
| `LLM_PROVIDER` | `ollama` | LLM backend (pluggable in `src/lib/llm.ts`). |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Where Ollama listens. |
| `OLLAMA_MODEL` | `llama3.2:1b` | Local model used for drafts. |
| `AUDIT_TIMEOUT_MS` | `12000` | Per-page audit fetch timeout. |
| `PSI_KEY` | _(empty)_ | Optional Google PageSpeed key (works without one at a low rate). |
| `SMTP_HOST/PORT/SECURE/USER/PASS/FROM` | _(empty)_ | Outgoing email (only used when `DRY_RUN=false`). See §8. |
| `EMAIL_DAILY_CAP` | `20` | Hard limit on cold emails per day. |
| `SEND_WINDOW_START` / `SEND_WINDOW_END` | `9` / `18` | Hours (24h) real email may be auto-sent. |
| `REDDIT_CLIENT_ID/SECRET/USERNAME/PASSWORD/USER_AGENT` | _(empty)_ | Optional Reddit lead source. See §10. |
| `RSS_FEEDS` | built-in set | Comma-separated feed URLs to scan. |
| `IMAP_HOST/PORT/SECURE/USER/PASS` | _(empty)_ | Optional reply detection. See §9. |
| `IMAP_POLL_MINUTES` | `5` | How often the worker checks for replies. |
| `GOAL_TARGET_USD` / `GOAL_DEADLINE` | `10000` / `2027-09-30` | Goal defaults (also editable on the Settings page). |

---

## 5. Running the app + worker

Open **two terminals**, both at the project root:

```powershell
# Terminal 1 — the dashboard
npm run dev
#   → open http://localhost:3000
```

```powershell
# Terminal 2 — the background worker (follow-up scheduler + optional reply polling)
npm run worker
```

> Keep both running from the project root so the relative SQLite path resolves to the
> same database. The first page load takes a few seconds (one-time compile); after that
> it's fast.

To stop: press `Ctrl+C` in each terminal.

---

## 6. The dashboard, page by page

- **Overview** (`/`) — KPIs + the **dynamic goal tracker** (progress, required monthly
  income, clients needed, conversion, suggested daily outreach) + this-week stats.
- **Leads** (`/leads`) — filter by status / band / source / service, search, and sort.
- **Lead detail** (`/leads/<id>`) — full picture of one lead:
  - **Score breakdown** — exactly which rules fired; click **Rescore & save**.
  - **Website audit** — click **Run website audit**.
  - **Outreach** — pick a channel and **Generate draft** (email or DM).
  - **Status / Notes** — edit; **Mark not interested (suppress)** to opt them out.
  - **Log a reply** — paste an inbound reply to set the lead to REPLIED and stop follow-ups.
  - **Timeline** — every message, follow-up, and audit in order.
- **Discover** (`/sources`) — find new leads:
  - **Paste & Enrich** — paste a LinkedIn/Instagram/X/Upwork URL and/or post text.
  - **Local businesses** — enter a city + category (e.g. `Lahore` / `cafe`).
  - **Job feeds (RSS)** — one click to scan the configured feeds.
  - **Reddit** — search (only if configured, §10).
  - **Manual search links** — open these yourself, then paste promising results back.
- **Outreach Queue** (`/outreach`) — **approve / edit / send / discard** drafts. A banner
  shows whether you're in DRY_RUN. Email "send" is auto in live mode; other channels are
  "mark sent" (you send them manually).
- **Replies** (`/replies`) — inbound reply log + IMAP status.
- **Settings** (`/settings`) — edit the **goal target/deadline**; view the env-driven config.

**Typical loop:** Discover → open a HOT lead → Run audit → Generate draft → approve & send
in the Outreach Queue → the worker handles follow-ups → log/auto-detect replies.

---

## 7. Try the whole pipeline (demo + tests)

```powershell
# Full DRY_RUN end-to-end demo on a throwaway lead, with a pass/fail report:
npm run demo

# 45 unit tests (pure logic across every module):
npm test
```

`npm run demo` walks the entire flow — discover → score → audit → draft → "send" (logged)
→ follow-up scheduled + sent → reply → goal — and asserts that **nothing actually left your
machine**.

---

## 8. Going live (sending real email)

> Do this only when you're ready. While `DRY_RUN=true`, sends are simulated.

1. **Pick an SMTP account.** A dedicated Gmail with an **App Password** works well:
   - Enable 2-Step Verification on the Google account.
   - Create an App Password: Google Account → Security → App passwords.
2. **Fill in `.env.local`:**
   ```
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT="465"
   SMTP_SECURE="true"
   SMTP_USER="you@gmail.com"
   SMTP_PASS="your-16-char-app-password"
   SMTP_FROM="Your Name <you@gmail.com>"
   EMAIL_DAILY_CAP="20"      # keep it low to protect your reputation
   SEND_WINDOW_START="9"
   SEND_WINDOW_END="18"
   ```
3. **Flip the switch:** set `DRY_RUN="false"` in `.env.local`.
4. **Restart** both `npm run dev` and `npm run worker` (env is read at startup).
5. Approve a draft in the **Outreach Queue** and click **Send**.

**Always enforced, even live:** the suppression list, the daily cap, the send window
(for auto-sends), step-deduplication, and a one-line unsubscribe footer. Anyone who replies
"stop"/"unsubscribe" is suppressed automatically.

> Tip: test against a local catcher first (e.g. [Mailpit](https://github.com/axllent/mailpit)
> or MailHog) by pointing `SMTP_HOST`/`SMTP_PORT` at it — real-looking sends, nothing leaves your machine.

---

## 9. Connecting reply detection (IMAP)

Optional. Lets the worker auto-detect replies in your own inbox and stop sequences.

1. In `.env.local`:
   ```
   IMAP_HOST="imap.gmail.com"
   IMAP_PORT="993"
   IMAP_SECURE="true"
   IMAP_USER="you@gmail.com"
   IMAP_PASS="your-16-char-app-password"
   IMAP_POLL_MINUTES="5"
   ```
2. Restart `npm run worker`. Its banner will show `IMAP : ON`.

The poller reads **unseen** INBOX messages, matches them to leads, records the reply, sets
the lead to **REPLIED** (or LOST + suppressed on opt-out), and cancels pending follow-ups.
Auto-replies, bounces, and your own sent mail are ignored. **Without IMAP**, use **Log a
reply** on the lead detail page.

---

## 10. Optional lead sources (Reddit, PageSpeed)

**Reddit** (free, non-commercial):

1. Create a "script" app at <https://www.reddit.com/prefs/apps> (note the client id + secret).
2. In `.env.local`:
   ```
   REDDIT_CLIENT_ID="..."
   REDDIT_CLIENT_SECRET="..."
   REDDIT_USERNAME="your_reddit_user"
   REDDIT_PASSWORD="your_reddit_pass"
   REDDIT_USER_AGENT="web:mind-client-engine:0.1 (by /u/your_reddit_user)"
   ```
3. Restart `npm run dev`. The Reddit search appears on the **Discover** page.

**Google PageSpeed** (optional richer audit): set `PSI_KEY` to a free key from
<https://console.cloud.google.com/apis/credentials>. Audits work without it too.

---

## 11. Resetting / backing up data

- **Reset to the sample dataset:** `npm run db:seed` (wipes leads/messages/etc. and reseeds).
- **Back up your data:** copy `prisma/dev.db` somewhere safe (it's the whole database).
- **Start completely fresh:** delete `prisma/dev.db`, then `npm run db:migrate` + `npm run db:seed`.

---

## 12. Troubleshooting

| Symptom | Fix |
|---|---|
| Drafts aren't LLM-personalized | Start Ollama and run `ollama pull llama3.2:1b`. Until then, deterministic templates are used (this is normal, not an error). |
| `npm install` fails building `better-sqlite3` | Switch to the pure-JS driver: `npm install @prisma/adapter-libsql @libsql/client`, then in `src/lib/db.ts` use `new PrismaLibSQL({ url: process.env.DATABASE_URL })`. Nothing else changes. |
| OSM/Nominatim returns 403 | Your `USER_AGENT` has a fake `example.com` contact. Put a real URL/email. |
| `prisma migrate dev` says "non-interactive" | Run it in a normal interactive terminal, or use `prisma db push` for local-only dev. |
| Worker isn't sending follow-ups | It only runs while `npm run worker` is open. Keep it running (or launch it via Windows Task Scheduler for always-on). |
| First page load is slow (~5s) | One-time compile; warm requests are ~200ms. |
| Email won't send in live mode | Check `DRY_RUN=false`, `SMTP_*` set, you're within the send window, under the daily cap, and the address isn't suppressed. |

---

## 13. Project structure

```
prisma/      schema.prisma, migrations/, seed.ts            # data model + sample data
src/app/     Next.js pages + API routes                     # the dashboard + /api/*
src/lib/     shared logic (db, config, llm, scoring,        # used by BOTH app and worker
             audit, sources, outreach, email, followups,
             replies, imap, goal)
worker/      standalone node-cron process                   # follow-up scheduler + IMAP poll
scripts/     demo-e2e + verify-phase7/8/9                    # run with: npx tsx scripts/<file>.ts
test/        unit tests                                      # npm test
```

---

## 14. Safety & compliance

Built in and enforced — not just suggestions:

- **DRY_RUN by default** — nothing is sent until you explicitly set `DRY_RUN=false`.
- **Public data only**, robots.txt respected, no automation on ToS-restricted platforms.
- **Strict daily email caps** + randomized human-like delays for auto-sends.
- **Suppression list** — never re-contact anyone who said "stop"/"unsubscribe"/bounced.
- **Step-deduplication** — the same lead is never messaged twice in the same step.
- **Full audit log** of every outbound/inbound action.
- **Human approval gate** for every channel except rate-limited cold email.
- OSM data (Overpass/Nominatim) is **ODbL** — attribute it wherever you display results.

Happy prospecting. 🚀

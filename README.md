<div align="center">

<h1>🧠 MiND Client Engine</h1>

<p><strong>A local-first, 100% free automated business-development assistant — built with Next.js, Prisma & SQLite.</strong></p>

<p>Lead discovery · website auditing · explainable scoring · LLM-personalized outreach · follow-up scheduling · dynamic goal tracker — all running on your machine for <strong>$0</strong>.</p>

[![Stars](https://img.shields.io/github/stars/aashir-athar/mind-client-engine?style=for-the-badge&logo=github&color=FFD33D)](https://github.com/aashir-athar/mind-client-engine/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/aashir-athar/mind-client-engine?style=for-the-badge)](https://github.com/aashir-athar/mind-client-engine/commits)
[![Top language](https://img.shields.io/github/languages/top/aashir-athar/mind-client-engine?style=for-the-badge&logo=typescript&logoColor=white)](https://github.com/aashir-athar/mind-client-engine)
[![Repo size](https://img.shields.io/github/repo-size/aashir-athar/mind-client-engine?style=for-the-badge)](https://github.com/aashir-athar/mind-client-engine)

<a href="#-getting-started"><strong>Get Started</strong></a> ·
<a href="#-features"><strong>Features</strong></a> ·
<a href="https://github.com/aashir-athar/mind-client-engine/issues"><strong>Report Bug</strong></a> ·
<a href="https://github.com/aashir-athar/mind-client-engine/issues"><strong>Request Feature</strong></a>

</div>

---

**MiND Client Engine** is a local-first, privacy-first sales-automation app for freelance developers and creators. It discovers leads, scores them with explainable rules, audits their websites, drafts personalized cold outreach with a local LLM, safely automates cold email under strict limits, schedules follow-ups, tracks replies, and surfaces everything on a dashboard with a **dynamic goal tracker** — running entirely on your own machine with no paid services and no paid APIs.

Think of it as a self-hosted, single-user CRM + outreach engine. Built on **Next.js (App Router)**, **Prisma 7**, and **SQLite**, it ships **DRY_RUN-safe by default**: nothing is ever sent while you develop, so your email reputation is never at risk.

> 🚦 **DRY_RUN by default.** With `DRY_RUN=true`, outbound actions are logged and written to the `AuditLog` table — treated as "sent" so the full pipeline runs safely without touching real inboxes.

## ✨ Features

| | Feature | Description |
|---|---|---|
| 🔎 | **Lead discovery** | Keyless OpenStreetMap (Overpass + Nominatim), RSS feeds, optional Reddit API, and a Paste-&-Enrich workflow. Dedupe by email/domain/source. |
| 🧮 | **Explainable scoring** | Deterministic, weighted rules → a 0–100 score + band (HOT/WARM/LOW), with an optional local-LLM tie-break near band edges. |
| 🩺 | **Website auditing** | robots.txt-respecting fetch via cheerio: HTTPS, mobile viewport, page size, SEO signals — plus optional PageSpeed (free key). |
| ✍️ | **LLM outreach** | Per-service, per-channel templates personalized with a **free local LLM (Ollama)** — with deterministic template fallback if the model is offline. |
| 📧 | **Safe cold email** | Nodemailer SMTP gated by suppression → daily cap → send window → DRY_RUN, with an unsubscribe footer and step-level dedupe. |
| ⏰ | **Follow-up scheduling** | A `node-cron` worker runs Day 1/3/7/14 sequences; email auto-sends, other channels draft, and the sequence stops on reply or opt-out. |
| 📥 | **Reply tracking** | Optional IMAP polling of your own inbox (or manual logging) auto-sets `REPLIED`, cancels follow-ups, and suppresses opt-outs. |
| 🎯 | **Dynamic goal tracker** | Computes required monthly income, clients needed, conversion, and suggested daily outreach from today's date and won revenue. |

> 🚧 **Status: complete (Phases 0–11).** Verified end-to-end in DRY_RUN on seed data: discover → score → audit → draft → "send" → follow-up → reply → goal updated. This is a single-user local app under active iteration.

## 🛠️ Tech Stack

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma_7-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-000000?style=for-the-badge&logo=ollama&logoColor=white)

</div>

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router), React 19 |
| **Language** | TypeScript 5 (strict) |
| **Database** | SQLite via Prisma 7 (`better-sqlite3` driver adapter) |
| **Validation** | Zod |
| **Email / Inbox** | Nodemailer (SMTP) · ImapFlow + mailparser (IMAP) |
| **Scheduling** | node-cron worker process |
| **Scraping / Audit** | cheerio · robots-parser · rss-parser |
| **LLM** | Local Ollama (`llama3.2:1b`), pluggable in `src/lib/llm.ts` |
| **Tooling** | tsx · node:test |

## 🚀 Getting Started

### Prerequisites

- **Node.js** `>= 20` (built on 24.7)
- **npm** `>= 10` (ships with Node)
- **Ollama** (optional) — free local LLM. Install from [ollama.com](https://ollama.com), then `ollama pull llama3.2:1b`. Without it, outreach falls back to deterministic templates and the app still works.

### Installation

```bash
git clone https://github.com/aashir-athar/mind-client-engine.git
cd mind-client-engine
npm install                  # installs deps (+ runs prisma generate)
```

### Configure & seed

```bash
cp .env.example .env.local   # edit for any secrets (optional in DRY_RUN)
npm run db:migrate           # creates prisma/dev.db + applies migrations + generates client
npm run db:seed              # loads a small, varied sample dataset
```

> `.env` holds committed non-secret defaults; `.env.local` (git-ignored) holds your secrets and overrides `.env`. `.env.example` lists **every** variable. On Windows PowerShell, use `copy .env.example .env.local`.

### Run

```bash
# Terminal 1 — the dashboard
npm run dev          # http://localhost:3000

# Terminal 2 — the background worker (follow-up scheduler + optional IMAP poll)
npm run worker
```

Start **both from the project root** so the relative SQLite path resolves to the same database.

## 📖 Usage

Run the full pipeline end-to-end in a single command, or execute the test suite:

```bash
npm run demo         # full DRY_RUN end-to-end demo on a throwaway lead, with a pass/fail report
npm test             # unit tests (audit, scoring, sources, outreach, email, follow-ups, replies, goal)
```

The dashboard exposes the whole workflow across its pages:

- **Overview** (`/`) — KPIs (leads, hot, sent, replies, follow-ups, won, revenue) + the dynamic goal tracker.
- **Leads** (`/leads`) — filter by status/band/source/service, search, and sort.
- **Lead detail** (`/leads/[id]`) — explainable score breakdown, website audit, timeline, generate outreach, log a reply.
- **Discover** (`/sources`) — Paste-&-Enrich, OSM/RSS/Reddit triggers, manual search links.
- **Outreach Queue** (`/outreach`) — approve / edit / send / discard drafts (with a DRY_RUN banner).
- **Replies** (`/replies`) — inbound reply log + IMAP status.
- **Settings** (`/settings`) — editable goal target/deadline; read-only env config.

<details>
<summary><strong>Key environment variables</strong></summary>

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `file:./prisma/dev.db` | SQLite path (relative — run from root). |
| `DRY_RUN` | `true` | **Safety.** `true` = nothing sent. Set `false` to send real email. |
| `USER_AGENT` | `MiNDClientEngine/0.1 (+url)` | Sent on all public-data fetches. Use a **real** URL/email — OSM/Nominatim block fake `example.com` contacts. |
| `LLM_PROVIDER` / `OLLAMA_HOST` / `OLLAMA_MODEL` | `ollama` / `127.0.0.1:11434` / `llama3.2:1b` | Local LLM config. |
| `SMTP_*` | _empty_ | Email send (only when `DRY_RUN=false`). |
| `EMAIL_DAILY_CAP` / `SEND_WINDOW_START` / `SEND_WINDOW_END` | `20` / `9` / `18` | Cold-email safety limits. |
| `IMAP_*` / `IMAP_POLL_MINUTES` | _empty_ / `5` | Optional reply detection. |
| `GOAL_TARGET_USD` / `GOAL_DEADLINE` | `10000` / `2027-09-30` | Goal defaults (editable on Settings). |

See [`.env.example`](./.env.example) for the complete list.

</details>

## 🧭 Design Principles

- **Everything free.** No paid dependency is ever required.
- **DRY_RUN by default.** Nothing is sent while developing; outbound actions are logged to the `AuditLog`.
- **Human-in-the-loop.** Only cold email auto-sends (under hard caps + suppression + dedupe). Every other channel produces a draft you approve manually.
- **No ToS-violating scrapers.** LinkedIn/Instagram/X/Upwork use a paste-&-enrich workflow + manual search links — never automation.
- **Respect robots.txt** and use only public data, with a descriptive `User-Agent` and free rate limits.

## 🗺️ Roadmap

- [x] Lead discovery (OSM, RSS, Reddit, Paste-&-Enrich)
- [x] Explainable scoring engine + band tie-break
- [x] robots.txt-respecting website auditor
- [x] LLM-personalized outreach with template fallback
- [x] DRY_RUN-safe cold email with caps + suppression
- [x] Follow-up scheduler + IMAP reply tracking
- [x] Dynamic goal tracker dashboard
- [ ] Additional pluggable lead sources
- [ ] Configurable scoring weights in the UI

## 🤝 Contributing

Contributions are welcome. This is a single-user local app, so please open an issue first for any major change.

1. Fork the repo
2. Create a branch (`git checkout -b feat/thing`)
3. Commit, push, and open a PR

## 📄 License

No license file is currently included in this repository. Please open an issue if you would like to discuss reuse or licensing terms.

## 👤 Author

**Aashir Athar**

[![GitHub](https://img.shields.io/badge/GitHub-aashir--athar-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/aashir-athar)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-aashirathar-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/aashirathar/)
[![X](https://img.shields.io/badge/X_(Twitter)-aashirathar-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/aashirathar)

---

<div align="center">

<sub>Built by <a href="https://github.com/aashir-athar">aashir-athar</a> · If this helped you, consider leaving a ⭐</sub>

<br/><br/>

<sub><strong>Keywords:</strong> local-first CRM · sales automation · cold email outreach · lead generation · Next.js · Prisma · SQLite · TypeScript · Ollama LLM · self-hosted business-development tool · privacy-first · DRY_RUN-safe</sub>

</div>

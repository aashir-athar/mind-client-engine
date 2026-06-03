// Single source of truth for runtime configuration.
//
// Reads process.env once at startup and validates it with zod, so a missing or
// malformed variable fails LOUD and early instead of causing a confusing crash
// deep in a route or job. Imported by both the Next.js app (env auto-loaded by
// Next) and the worker (env loaded first by worker/load-env via @next/env).
import { z } from "zod";

// Env vars are always strings; treat "true"/"1"/"yes"/"on" (any case) as true.
const boolish = z
  .union([z.boolean(), z.string()])
  .transform((v) =>
    typeof v === "boolean" ? v : ["true", "1", "yes", "on"].includes(v.toLowerCase()),
  );

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required — check your .env"),

  // SAFETY DEFAULT: true. Nothing is sent unless this is explicitly false.
  DRY_RUN: boolish.default(true),

  USER_AGENT: z.string().default("MiNDClientEngine/0.1 (+https://github.com/mind-client-engine)"),

  // Website auditor (Phase 3)
  AUDIT_TIMEOUT_MS: z.coerce.number().default(12000),
  // Google PageSpeed Insights: optional. When unset, PageSpeed is skipped (the
  // four core checks still run with zero APIs). Free key adds the performance score.
  PSI_KEY: z.string().optional(),

  // Lead sources (Phase 5)
  // Reddit OAuth (free non-commercial "script" app). All optional — Reddit is
  // skipped gracefully when these are unset.
  REDDIT_CLIENT_ID: z.string().optional(),
  REDDIT_CLIENT_SECRET: z.string().optional(),
  REDDIT_USERNAME: z.string().optional(),
  REDDIT_PASSWORD: z.string().optional(),
  REDDIT_USER_AGENT: z.string().optional(),
  // Comma-separated RSS/Atom feed URLs; a verified-live default set is used when empty.
  RSS_FEEDS: z.string().optional(),

  // LLM (local Ollama by default; pluggable in src/lib/llm.ts)
  LLM_PROVIDER: z.string().default("ollama"),
  OLLAMA_HOST: z.string().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().default("llama3.2:1b"),

  // Email engine (Phase 7). All SMTP_* optional — needed only when DRY_RUN=false.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: boolish.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  // Hard safety limits for cold email.
  EMAIL_DAILY_CAP: z.coerce.number().default(20),
  SEND_WINDOW_START: z.coerce.number().default(9), // 24h hour, inclusive
  SEND_WINDOW_END: z.coerce.number().default(18), // 24h hour, exclusive

  // Replies / IMAP (Phase 9). All optional — IMAP polling is skipped when unset.
  IMAP_HOST: z.string().optional(),
  IMAP_PORT: z.coerce.number().default(993),
  IMAP_SECURE: boolish.default(true),
  IMAP_USER: z.string().optional(),
  IMAP_PASS: z.string().optional(),
  IMAP_POLL_MINUTES: z.coerce.number().default(5),

  // Goal tracker (the Overview page computes progress dynamically against today)
  GOAL_TARGET_USD: z.coerce.number().default(10000),
  GOAL_DEADLINE: z.string().default("2027-09-30"),
});

export type AppConfig = z.infer<typeof EnvSchema>;

function loadConfig(): AppConfig {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`,
    );
    throw new Error(
      `Invalid environment configuration:\n${lines.join("\n")}\n\n` +
        `Fix your .env / .env.local files. See .env.example for the full list.`,
    );
  }
  return parsed.data;
}

export const config = loadConfig();

/** Convenience: the global send-safety flag. */
export const DRY_RUN = config.DRY_RUN;

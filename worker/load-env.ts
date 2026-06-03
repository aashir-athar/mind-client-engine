// MUST be imported FIRST by any standalone (non-Next) entry point — the worker
// and the seed script. A process run outside `next` does not auto-load .env, so
// we use @next/env (the same loader Next uses internally) to read .env / .env.local
// with the exact same precedence and $-variable expansion the app uses. This keeps
// DATABASE_URL and every other variable identical between the app and the worker.
// @next/env is CommonJS; a named ESM import isn't statically detectable, so we
// default-import the module object (Node exposes module.exports as default).
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

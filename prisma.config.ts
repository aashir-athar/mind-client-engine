// Prisma 7 configuration. Prisma 7's CLI does not auto-load .env, so we load it
// here (the SAME way Next.js and the worker do, via @next/env) before the CLI
// resolves env("DATABASE_URL") in schema.prisma.
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  // Connection URL for Migrate / introspection (Prisma 7 moved this out of the schema).
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    // `prisma migrate reset` / `prisma db seed` will run our tsx seed script.
    seed: "tsx prisma/seed.ts",
  },
});

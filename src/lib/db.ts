// THE single shared PrismaClient for the whole app.
//
// Prisma 7 requires a driver adapter for SQLite (a bare `new PrismaClient()` will
// NOT connect). We use the better-sqlite3 adapter. The same instance is imported
// by Next.js route handlers AND the standalone worker, so there is exactly one
// source of truth. The globalThis guard prevents Next's dev hot-reload from
// opening a new connection on every edit (harmless in the worker, which has no
// hot-reload).
//
// WINDOWS NATIVE-BUILD FALLBACK: if better-sqlite3 ever fails to compile, swap to
// the pure-JS libSQL adapter with zero code changes elsewhere:
//   npm install @prisma/adapter-libsql @libsql/client
//   import { PrismaLibSQL } from "@prisma/adapter-libsql";
//   const adapter = new PrismaLibSQL({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" });
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";

function createPrismaClient() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

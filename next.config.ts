import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Prisma + the native SQLite driver out of the server bundle so they are
  // loaded as regular Node modules in route handlers (native addons can't be bundled).
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-better-sqlite3",
    "better-sqlite3",
    "cheerio",
    "robots-parser",
    "rss-parser",
    "nodemailer",
  ],
};

export default nextConfig;

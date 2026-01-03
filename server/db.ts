import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const connectionString = process.env.DATABASE_URL;

/**
 * In production we require DATABASE_URL. In development, the app supports an in-memory
 * storage fallback, so we allow the server to boot without Postgres.
 */
export const pool: Pool | null = connectionString
  ? new Pool({
      connectionString,
      ssl: connectionString?.includes("sslmode=require")
        ? { rejectUnauthorized: false }
        : undefined,
    })
  : null;

export const db = pool ? drizzle(pool, { schema }) : null;

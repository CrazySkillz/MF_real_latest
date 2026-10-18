import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const connectionString = process.env.DATABASE_URL;

/**
 * DATABASE_URL is required for database-backed storage.
 */
export const pool: Pool | null = connectionString
  ? new Pool({
      connectionString,
      // Bound reads as well as writes: racing an HTTP/pipeline promise cannot
      // cancel a PostgreSQL statement or release a queued pool checkout.
      connectionTimeoutMillis: 10_000,
      statement_timeout: 120_000,
      query_timeout: 125_000,
      idle_in_transaction_session_timeout: 120_000,
      ssl: connectionString?.includes("sslmode=require")
        ? { rejectUnauthorized: false }
        : undefined,
    })
  : null;

// Type as any so downstream code (DatabaseStorage) doesn't become a noisy `db | null` union.
export const db: any = pool ? drizzle(pool, { schema }) : null;

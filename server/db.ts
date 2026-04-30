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
      ssl: connectionString?.includes("sslmode=require")
        ? { rejectUnauthorized: false }
        : undefined,
    })
  : null;

// Type as any so downstream code (DatabaseStorage) doesn't become a noisy `db | null` union.
export const db: any = pool ? drizzle(pool, { schema }) : null;

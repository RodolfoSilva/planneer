import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://planneer:planneer@localhost:5432/planneer';

const client = postgres(connectionString);
export const db = drizzle(client, { schema });

export type Database = typeof db;
export { schema };




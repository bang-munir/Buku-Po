import { neon } from '@neondatabase/serverless';

let cachedQuery: ReturnType<typeof neon> | undefined;

export function neonQuery(): ReturnType<typeof neon> {
  if (!cachedQuery) {
    const connectionString = process.env.NEON_DATABASE_URL;
    if (!connectionString) {
      throw new Error('NEON_DATABASE_URL environment variable is not set');
    }
    cachedQuery = neon(connectionString);
  }
  return cachedQuery;
}

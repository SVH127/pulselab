import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const pgDataDir = path.join(rootDir, '.pgdata');

function loadEnvDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(rootDir, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/^DATABASE_URL=(.+)$/m);
    if (match && match[1].trim()) {
      return match[1].trim();
    }
  }
  return null;
}

export async function getPostgresClient() {
  const supabaseOrLocalUrl = loadEnvDatabaseUrl();

  // 1. Intentar conectar primero al DATABASE_URL configurado en .env (Supabase Cloud PostgreSQL)
  if (supabaseOrLocalUrl) {
    try {
      const isSupabasePooler = supabaseOrLocalUrl.includes('supabase.com') || supabaseOrLocalUrl.includes('supabase.co');
      const client = new pg.Client({
        connectionString: supabaseOrLocalUrl,
        ssl: isSupabasePooler ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 6000,
      });
      await client.connect();
      return {
        mode: isSupabasePooler
          ? 'Supabase Cloud PostgreSQL (pulselab-dev)'
          : `PostgreSQL Server (${supabaseOrLocalUrl})`,
        query: (sql, params) => client.query(sql, params),
        exec: (sql) => client.query(sql),
        end: () => client.end(),
      };
    } catch (err) {
      console.warn('⚠️ No se pudo conectar a DATABASE_URL, probando fallback local:', err.message);
    }
  }

  // 2. Fallback: Motor PostgreSQL 16 local embebido (PGlite) en ./.pgdata
  const db = new PGlite(pgDataDir);
  await db.waitReady;
  return {
    mode: `PostgreSQL 16 Local Embebido (${pgDataDir})`,
    query: (sql, params) => db.query(sql, params),
    exec: (sql) => db.exec(sql),
    end: () => db.close(),
  };
}

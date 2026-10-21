import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const pgDataDir = path.join(rootDir, '.pgdata');

export async function getPostgresClient() {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/pulselab';

  // Intentar conectar primero al servidor PostgreSQL local en puerto 5432
  try {
    const adminUrl = connectionString.replace(/\/[^/]+$/, '/postgres');
    const adminClient = new pg.Client({
      connectionString: adminUrl,
      connectionTimeoutMillis: 1500,
    });
    await adminClient.connect();
    const { rows } = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = 'pulselab'"
    );
    if (rows.length === 0) {
      await adminClient.query('CREATE DATABASE pulselab');
    }
    await adminClient.end();

    const client = new pg.Client({ connectionString });
    await client.connect();
    return {
      mode: `PostgreSQL Server (${connectionString})`,
      query: (sql, params) => client.query(sql, params),
      exec: (sql) => client.query(sql),
      end: () => client.end(),
    };
  } catch {
    // Si el servicio del puerto 5432 no está activo, usar motor PostgreSQL 16 embebido (PGlite) en ./.pgdata
    const db = new PGlite(pgDataDir);
    await db.waitReady;
    return {
      mode: `PostgreSQL 16 Local Embebido (${pgDataDir})`,
      query: (sql, params) => db.query(sql, params),
      exec: (sql) => db.exec(sql),
      end: () => db.close(),
    };
  }
}

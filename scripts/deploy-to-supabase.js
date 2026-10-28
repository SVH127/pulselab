import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'qajnodohyuvlsvlbshwf';
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;

if (!DB_PASSWORD && !process.env.DATABASE_URL) {
  console.error('Falta definir SUPABASE_DB_PASSWORD o DATABASE_URL en las variables de entorno.');
  process.exit(1);
}

const CANDIDATE_URLS = process.env.DATABASE_URL
  ? [process.env.DATABASE_URL]
  : [
      `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(DB_PASSWORD)}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
      `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(DB_PASSWORD)}@aws-1-us-east-1.pooler.supabase.com:5432/postgres`,
      `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(DB_PASSWORD)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
      `postgresql://postgres:${encodeURIComponent(DB_PASSWORD)}@db.${PROJECT_REF}.supabase.co:5432/postgres`,
    ];

async function connectToSupabase() {
  for (const url of CANDIDATE_URLS) {
    const safeUrl = DB_PASSWORD ? url.replace(encodeURIComponent(DB_PASSWORD), '****') : url;
    try {
      console.log(`Intentando conectar a: ${safeUrl} ...`);
      const client = new pg.Client({
        connectionString: url,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 6000,
      });
      await client.connect();
      console.log(`✅ Conectado exitosamente a Supabase (${safeUrl})`);
      return client;
    } catch (err) {
      console.log(`   -> No disponible (${err.message})`);
    }
  }
  throw new Error('No se pudo conectar a ninguno de los endpoints de Supabase.');
}

async function run() {
  const client = await connectToSupabase();
  try {
    const schemaSql = fs.readFileSync(
      path.join(rootDir, 'supabase', 'migrations', '20261021000100_esquema_relacional_pulselab.sql'),
      'utf8'
    );
    await client.query(schemaSql);
    console.log('✅ 1/3 Esquema relacional desplegado en Supabase (usuario, caso_clinico, pregunta, resultado, respuesta_alumno)');

    const rlsSql = fs.readFileSync(
      path.join(rootDir, 'supabase', 'migrations', '20261021000200_politicas_rls.sql'),
      'utf8'
    );
    await client.query(rlsSql);
    console.log('✅ 2/3 Políticas Row Level Security (RLS) activadas en Supabase');

    const seedSql = fs.readFileSync(path.join(rootDir, 'supabase', 'seed.sql'), 'utf8');
    await client.query(seedSql);
    console.log('✅ 3/3 Datos iniciales (seed.sql) insertados en Supabase');

    const { rows } = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM public.usuario) AS usuarios,
        (SELECT COUNT(*)::int FROM public.caso_clinico) AS casos_clinicos,
        (SELECT COUNT(*)::int FROM public.pregunta) AS preguntas,
        (SELECT COUNT(*)::int FROM public.resultado) AS resultados,
        (SELECT COUNT(*)::int FROM public.respuesta_alumno) AS respuestas_alumno;
    `);
    console.log('\n📊 Conteo actual en tu base de datos de Supabase Cloud:\n', rows[0]);
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('❌ Error desplegando a Supabase:', err.message);
  process.exit(1);
});

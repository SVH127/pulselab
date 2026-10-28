import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { getPostgresClient } from './db-connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function loadEnv() {
  const envPath = path.join(rootDir, '.env');
  const vars = {};
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) vars[m[1]] = m[2].trim();
    }
  }
  return vars;
}

async function main() {
  const env = loadEnv();

  // 1. Aplicar políticas RLS actualizadas y asegurar usuarios admin en Supabase PostgreSQL
  const pgClient = await getPostgresClient();
  try {
    const rlsSql = fs.readFileSync(
      path.join(rootDir, 'supabase', 'migrations', '20261021000200_politicas_rls.sql'),
      'utf8'
    );
    await pgClient.exec(rlsSql);
    await pgClient.query(`
      INSERT INTO public.usuario (nombre, rol, correo, activo)
      VALUES
        ('Sebastián Vázquez (Admin)', 'admin', 'vazquezhernandezsebastian1@gmail.com', TRUE),
        ('Admin Colaborador', 'admin', 'f.gzlr55@gmail.com', TRUE)
      ON CONFLICT (correo) DO UPDATE SET rol = 'admin', activo = TRUE;
    `);
    console.log('✅ Políticas RLS y cuentas de administrador actualizadas en:', pgClient.mode);
  } finally {
    await pgClient.end();
  }

  // 2. Probar el cliente @supabase/supabase-js con la Publishable/Anon Key
  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

  const { data: casos, error: casosErr } = await supabase
    .from('caso_clinico')
    .select('*, pregunta(*)');

  if (casosErr) throw casosErr;
  console.log(`✅ @supabase/supabase-js conectó con éxito: ${casos.length} caso(s) clínico(s) leído(s) desde la API REST de Supabase.`);

  const { data: usuarios, error: userErr } = await supabase
    .from('usuario')
    .select('id_usuario, nombre, correo, rol, activo');

  if (userErr) throw userErr;
  console.log('✅ Usuarios registrados actualmente en Supabase:', usuarios);
}

main().catch((err) => {
  console.error('❌ Error en verificación:', err);
  process.exit(1);
});

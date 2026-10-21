import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPostgresClient } from './db-connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

let dbPromise = null;

async function getInitializedDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const client = await getPostgresClient();
      const schemaSql = fs.readFileSync(
        path.join(rootDir, 'supabase', 'migrations', '20261021000100_esquema_relacional_pulselab.sql'),
        'utf8'
      );
      const seedSql = fs.readFileSync(path.join(rootDir, 'supabase', 'seed.sql'), 'utf8');
      await client.exec(schemaSql);
      const { rows } = await client.query('SELECT COUNT(*)::int AS cnt FROM public.caso_clinico');
      if (rows[0].cnt === 0) {
        await client.exec(seedSql);
      }
      console.log(`🗄️  [PulseLab SQL Local] Conectado a ${client.mode}`);
      return client;
    })();
  }
  return dbPromise;
}

const toNum = (v) => {
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const mapUsuario = (r) =>
  r && {
    id: String(r.id_usuario),
    id_usuario: r.id_usuario,
    email: r.correo,
    full_name: r.nombre,
    name: r.nombre,
    role: r.rol,
    is_active: r.activo !== false,
    created_date: r.fecha_registro,
  };

async function getCasoById(db, idCaso) {
  const { rows: casos } = await db.query(
    'SELECT * FROM public.caso_clinico WHERE id_caso_clinico = $1',
    [Number(idCaso)]
  );
  const c = casos[0];
  if (!c) return null;
  const { rows: preguntas } = await db.query(
    'SELECT * FROM public.pregunta WHERE caso_clinico_id_caso_clinico = $1 ORDER BY orden ASC',
    [c.id_caso_clinico]
  );
  return {
    id: String(c.id_caso_clinico),
    id_caso_clinico: c.id_caso_clinico,
    title: c.titulo || '',
    description: c.descripcion || '',
    status: c.estado || 'draft',
    patient_name: c.nombre_paciente || '',
    patient_age: c.edad_paciente ?? '',
    patient_weight: c.peso_paciente !== null ? Number(c.peso_paciente) : '',
    patient_height: c.talla_paciente !== null ? Number(c.talla_paciente) : '',
    patient_bmi: c.imc !== null ? Number(c.imc) : '',
    fc: c.fc ?? '',
    fr: c.fr ?? '',
    spo2: c.spo2 ?? '',
    pa_systolic: c.pa_sistolica ?? '',
    pa_diastolic: c.pa_diastolica ?? '',
    temperature: c.temperatura !== null ? Number(c.temperatura) : '',
    duration_minutes: c.duracion_minutos ?? '',
    created_date: c.fecha_creacion,
    questions: preguntas.map((q) => ({
      id: String(q.id_pregunta),
      text: q.texto || '',
      option_a: q.opcion_a || '',
      option_b: q.opcion_b || '',
      option_c: q.opcion_c || '',
      option_d: q.opcion_d || '',
      correct_option: (q.opcion_correcta || 'a').trim().toLowerCase(),
      feedback: q.retroalimentacion || '',
      concept: q.concepto || '',
    })),
  };
}

export function localPostgresApiPlugin() {
  return {
    name: 'pulselab-local-postgres-api',
    configureServer(server) {
      server.middlewares.use('/api/local-pg', async (req, res) => {
        const db = await getInitializedDb();

        // Visor visual de la estructura y datos de PostgreSQL (GET /api/local-pg)
        if (req.method === 'GET') {
          try {
            const { rows: cols } = await db.query(`
              SELECT
                c.table_name,
                c.column_name,
                c.data_type,
                c.character_maximum_length,
                c.is_nullable,
                c.column_default
              FROM information_schema.columns c
              WHERE c.table_schema = 'public'
                AND c.table_name IN ('usuario', 'caso_clinico', 'pregunta', 'resultado', 'respuesta_alumno')
              ORDER BY c.table_name, c.ordinal_position;
            `);

            const { rows: fks } = await db.query(`
              SELECT
                tc.table_name,
                kcu.column_name,
                tc.constraint_type,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
              FROM information_schema.table_constraints AS tc
              JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
              LEFT JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
              WHERE tc.table_schema = 'public'
                AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE');
            `);

            const tables = ['usuario', 'caso_clinico', 'pregunta', 'resultado', 'respuesta_alumno'];
            const tableData = {};
            for (const t of tables) {
              const { rows } = await db.query(`SELECT * FROM public.${t} LIMIT 50`);
              tableData[t] = rows;
            }

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>PulseLab - Inspector PostgreSQL Local</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #090d16; color: #e2e8f0; margin: 0; padding: 24px; }
    h1 { color: #38bdf8; margin-top: 0; }
    .subtitle { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(460px, 1fr)); gap: 20px; }
    .card { background: #111827; border: 1px solid #1e293b; border-radius: 12px; padding: 16px; overflow-x: auto; }
    .card h2 { margin: 0 0 12px 0; color: #f8fafc; font-size: 18px; display: flex; justify-content: space-between; align-items: center; }
    .badge { font-size: 11px; padding: 2px 8px; border-radius: 999px; font-family: monospace; }
    .pk { background: #eab30820; color: #facc15; border: 1px solid #eab30850; }
    .fk { background: #38bdf820; color: #38bdf8; border: 1px solid #38bdf850; }
    .uq { background: #a855f720; color: #c084fc; border: 1px solid #a855f750; }
    table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 12px; }
    th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #1e293b; font-family: ui-monospace, monospace; }
    th { color: #94a3b8; font-weight: 600; background: #0f172a; }
    .section-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin: 12px 0 6px; font-weight: 700; }
  </style>
</head>
<body>
  <h1>🗄️ PulseLab — Estructura y Datos de PostgreSQL Local</h1>
  <p class="subtitle">Consultado en vivo desde <code>information_schema</code> en PostgreSQL 16 (5 tablas relacionales en español)</p>
  <div class="grid">
    ${tables
      .map((t) => {
        const tCols = cols.filter((c) => c.table_name === t);
        const tFks = fks.filter((f) => f.table_name === t);
        const rows = tableData[t] || [];
        return `
      <div class="card">
        <h2>Tabla: <code>public.${t}</code> <span class="badge fk">${rows.length} fila(s)</span></h2>
        <div class="section-label">Columnas y Restricciones</div>
        <table>
          <thead><tr><th>Columna</th><th>Tipo</th><th>Nulo</th><th>Clave / Relación</th></tr></thead>
          <tbody>
            ${tCols
              .map((c) => {
                const constraints = tFks.filter((f) => f.column_name === c.column_name);
                const badges = constraints
                  .map((con) => {
                    if (con.constraint_type === 'PRIMARY KEY') return '<span class="badge pk">PK</span>';
                    if (con.constraint_type === 'FOREIGN KEY')
                      return `<span class="badge fk">FK → ${con.foreign_table_name}.${con.foreign_column_name}</span>`;
                    if (con.constraint_type === 'UNIQUE') return '<span class="badge uq">UNIQUE</span>';
                    return '';
                  })
                  .join(' ');
                return `<tr>
                  <td><strong>${c.column_name}</strong></td>
                  <td>${c.data_type}${c.character_maximum_length ? `(${c.character_maximum_length})` : ''}</td>
                  <td>${c.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}</td>
                  <td>${badges || '-'}</td>
                </tr>`;
              })
              .join('')}
          </tbody>
        </table>
        <div class="section-label">Registros actuales (${rows.length})</div>
        ${
          rows.length === 0
            ? '<p style="color:#64748b;font-size:12px;">Sin registros</p>'
            : `<table>
                <thead><tr>${Object.keys(rows[0])
                  .map((k) => `<th>${k}</th>`)
                  .join('')}</tr></thead>
                <tbody>
                  ${rows
                    .map(
                      (r) =>
                        `<tr>${Object.values(r)
                          .map((v) => `<td>${v === null ? '<em>null</em>' : String(v).slice(0, 60)}</td>`)
                          .join('')}</tr>`
                    )
                    .join('')}
                </tbody>
              </table>`
        }
      </div>`;
      })
      .join('')}
  </div>
</body>
</html>`);
            return;
          } catch (err) {
            res.statusCode = 500;
            res.end(err.message);
            return;
          }
        }

        res.setHeader('Content-Type', 'application/json');
        try {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
          const { entity, action, id, data, criteria, sortBy } = body;

          if (entity === 'ClinicalCase') {
            if (action === 'list' || action === 'filter') {
              const asc = sortBy && !sortBy.startsWith('-');
              const { rows } = await db.query(
                `SELECT id_caso_clinico FROM public.caso_clinico ORDER BY fecha_creacion ${asc ? 'ASC' : 'DESC'}`
              );
              let items = await Promise.all(rows.map((r) => getCasoById(db, r.id_caso_clinico)));
              if (criteria?.status) {
                items = items.filter((i) => i.status === criteria.status);
              }
              res.end(JSON.stringify({ data: items }));
              return;
            }
            if (action === 'get') {
              const item = await getCasoById(db, id);
              if (!item) throw new Error('ClinicalCase not found');
              res.end(JSON.stringify({ data: item }));
              return;
            }
            if (action === 'create') {
              const { rows } = await db.query(
                `INSERT INTO public.caso_clinico (
                  titulo, descripcion, estado, nombre_paciente, edad_paciente,
                  peso_paciente, talla_paciente, imc, fc, fr, spo2,
                  pa_sistolica, pa_diastolica, temperatura, duracion_minutos
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
                RETURNING id_caso_clinico`,
                [
                  data.title,
                  data.description || null,
                  data.status || 'draft',
                  data.patient_name || null,
                  toNum(data.patient_age),
                  toNum(data.patient_weight),
                  toNum(data.patient_height),
                  toNum(data.patient_bmi),
                  toNum(data.fc),
                  toNum(data.fr),
                  toNum(data.spo2),
                  toNum(data.pa_systolic),
                  toNum(data.pa_diastolic),
                  toNum(data.temperature),
                  toNum(data.duration_minutes),
                ]
              );
              const idCaso = rows[0].id_caso_clinico;
              if (Array.isArray(data.questions)) {
                for (let i = 0; i < data.questions.length; i++) {
                  const q = data.questions[i];
                  await db.query(
                    `INSERT INTO public.pregunta (
                      texto, retroalimentacion, orden, opcion_a, opcion_b, opcion_c, opcion_d,
                      concepto, opcion_correcta, caso_clinico_id_caso_clinico
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
                    [
                      q.text || '',
                      q.feedback || null,
                      i + 1,
                      q.option_a || '',
                      q.option_b || '',
                      q.option_c || '',
                      q.option_d || '',
                      q.concept || null,
                      String(q.correct_option || 'a').trim().toLowerCase().slice(0, 1),
                      idCaso,
                    ]
                  );
                }
              }
              res.end(JSON.stringify({ data: await getCasoById(db, idCaso) }));
              return;
            }
            if (action === 'update') {
              const current = await getCasoById(db, id);
              if (!current) throw new Error('ClinicalCase not found');
              const merged = { ...current, ...data };
              await db.query(
                `UPDATE public.caso_clinico SET
                  titulo = $1, descripcion = $2, estado = $3, nombre_paciente = $4,
                  edad_paciente = $5, peso_paciente = $6, talla_paciente = $7, imc = $8,
                  fc = $9, fr = $10, spo2 = $11, pa_sistolica = $12, pa_diastolica = $13,
                  temperatura = $14, duracion_minutos = $15
                WHERE id_caso_clinico = $16`,
                [
                  merged.title,
                  merged.description || null,
                  merged.status || 'draft',
                  merged.patient_name || null,
                  toNum(merged.patient_age),
                  toNum(merged.patient_weight),
                  toNum(merged.patient_height),
                  toNum(merged.patient_bmi),
                  toNum(merged.fc),
                  toNum(merged.fr),
                  toNum(merged.spo2),
                  toNum(merged.pa_systolic),
                  toNum(merged.pa_diastolic),
                  toNum(merged.temperature),
                  toNum(merged.duration_minutes),
                  Number(id),
                ]
              );
              if (Array.isArray(data.questions)) {
                await db.query('DELETE FROM public.pregunta WHERE caso_clinico_id_caso_clinico = $1', [Number(id)]);
                for (let i = 0; i < data.questions.length; i++) {
                  const q = data.questions[i];
                  await db.query(
                    `INSERT INTO public.pregunta (
                      texto, retroalimentacion, orden, opcion_a, opcion_b, opcion_c, opcion_d,
                      concepto, opcion_correcta, caso_clinico_id_caso_clinico
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
                    [
                      q.text || '',
                      q.feedback || null,
                      i + 1,
                      q.option_a || '',
                      q.option_b || '',
                      q.option_c || '',
                      q.option_d || '',
                      q.concept || null,
                      String(q.correct_option || 'a').trim().toLowerCase().slice(0, 1),
                      Number(id),
                    ]
                  );
                }
              }
              res.end(JSON.stringify({ data: await getCasoById(db, id) }));
              return;
            }
            if (action === 'delete') {
              await db.query('DELETE FROM public.caso_clinico WHERE id_caso_clinico = $1', [Number(id)]);
              res.end(JSON.stringify({ data: true }));
              return;
            }
          }

          if (entity === 'StudentResult') {
            if (action === 'list' || action === 'filter') {
              const { rows } = await db.query(`
                SELECT
                  r.*,
                  u.correo AS student_email,
                  u.nombre AS student_name,
                  c.titulo AS case_title
                FROM public.resultado r
                JOIN public.usuario u ON u.id_usuario = r.usuario_id_usuario
                JOIN public.caso_clinico c ON c.id_caso_clinico = r.caso_clinico_id_caso_clinico
                ORDER BY r.fecha_completado DESC
              `);
              const results = [];
              for (const r of rows) {
                const { rows: ansRows } = await db.query(
                  `SELECT ra.*, p.orden
                   FROM public.respuesta_alumno ra
                   JOIN public.pregunta p ON p.id_pregunta = ra.pregunta_id_pregunta
                   WHERE ra.resultado_id_resultado = $1
                   ORDER BY p.orden ASC`,
                  [r.id_resultado]
                );
                results.push({
                  id: String(r.id_resultado),
                  student_email: r.student_email,
                  student_name: r.student_name,
                  case_id: String(r.caso_clinico_id_caso_clinico),
                  case_title: r.case_title,
                  correct_count: r.aciertos,
                  total_questions: r.total_preguntas,
                  time_used_seconds: r.tiempo_usado_segundos,
                  percentage: Math.round(Number(r.porcentaje || 0)),
                  completed_at: r.fecha_completado,
                  wildcard_used: Boolean(r.comodin_usado),
                  answers: ansRows.map((a, idx) => ({
                    question_index: a.orden ? a.orden - 1 : idx,
                    selected_option: a.opcion_seleccionada ? a.opcion_seleccionada.trim() : null,
                    is_correct: Boolean(a.es_correcta),
                    timed_out: Boolean(a.tiempo_agotado),
                  })),
                });
              }
              res.end(JSON.stringify({ data: results }));
              return;
            }
            if (action === 'create') {
              const email = String(data.student_email || '').trim().toLowerCase();
              const { rows: uRows } = await db.query(
                `INSERT INTO public.usuario (nombre, rol, correo, activo)
                 VALUES ($1, 'student', $2, TRUE)
                 ON CONFLICT (correo) DO UPDATE SET nombre = EXCLUDED.nombre
                 RETURNING id_usuario`,
                [data.student_name || email, email]
              );
              const idUsuario = uRows[0].id_usuario;
              const idCaso = Number(data.case_id);
              const { rows: rRows } = await db.query(
                `INSERT INTO public.resultado (
                  tiempo_usado_segundos, total_preguntas, comodin_usado,
                  aciertos, porcentaje, fecha_completado,
                  usuario_id_usuario, caso_clinico_id_caso_clinico
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                RETURNING *`,
                [
                  Number(data.time_used_seconds || 0),
                  Number(data.total_questions || 0),
                  Boolean(data.wildcard_used),
                  Number(data.correct_count || 0),
                  Number(data.percentage || 0),
                  data.completed_at || new Date().toISOString(),
                  idUsuario,
                  idCaso,
                ]
              );
              const idResultado = rRows[0].id_resultado;
              const { rows: preguntas } = await db.query(
                'SELECT id_pregunta, orden FROM public.pregunta WHERE caso_clinico_id_caso_clinico = $1 ORDER BY orden ASC',
                [idCaso]
              );
              for (let i = 0; i < (data.answers || []).length; i++) {
                const ans = data.answers[i];
                const q = preguntas.find((p) => p.orden === Number(ans.question_index ?? i) + 1) || preguntas[i];
                if (!q) continue;
                await db.query(
                  `INSERT INTO public.respuesta_alumno (
                    opcion_seleccionada, es_correcta, tiempo_agotado,
                    resultado_id_resultado, pregunta_id_pregunta
                  ) VALUES ($1,$2,$3,$4,$5)
                  ON CONFLICT (resultado_id_resultado, pregunta_id_pregunta) DO NOTHING`,
                  [
                    ans.selected_option ? String(ans.selected_option).trim().toLowerCase().slice(0, 1) : null,
                    Boolean(ans.is_correct),
                    Boolean(ans.timed_out),
                    idResultado,
                    q.id_pregunta,
                  ]
                );
              }
              res.end(JSON.stringify({ data: rRows[0] }));
              return;
            }
          }

          if (entity === 'User' || entity === 'PendingUser' || entity === 'StudentAccount') {
            if (action === 'list' || action === 'filter') {
              const { rows } = await db.query('SELECT * FROM public.usuario ORDER BY fecha_registro DESC');
              let list = rows.map(mapUsuario);
              if (entity === 'StudentAccount') {
                list = list.filter((u) => u.role === 'student' || u.role === 'user');
              }
              if (criteria) {
                list = list.filter((u) =>
                  Object.entries(criteria).every(([k, v]) =>
                    k === 'email' ? u.email.toLowerCase() === String(v).toLowerCase() : u[k] === v
                  )
                );
              }
              res.end(JSON.stringify({ data: list }));
              return;
            }
            if (action === 'get') {
              const str = String(id || '').trim();
              const isEmail = str.includes('@');
              const { rows } = await db.query(
                isEmail
                  ? 'SELECT * FROM public.usuario WHERE LOWER(correo) = LOWER($1)'
                  : /^\d+$/.test(str)
                  ? 'SELECT * FROM public.usuario WHERE id_usuario = $1'
                  : 'SELECT * FROM public.usuario WHERE firebase_uid = $1',
                [isEmail || !/^\d+$/.test(str) ? str : Number(str)]
              );
              if (!rows[0]) throw new Error('usuario not found');
              res.end(JSON.stringify({ data: mapUsuario(rows[0]) }));
              return;
            }
            if (action === 'create') {
              const correo = String(data.email || data.id || '').trim().toLowerCase();
              const nombre = (data.full_name || data.name || correo).trim();
              const rol = data.role || (entity === 'StudentAccount' ? 'student' : 'student');
              const activo = data.is_active !== false;
              const { rows } = await db.query(
                `INSERT INTO public.usuario (nombre, rol, correo, activo)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (correo) DO UPDATE SET
                   nombre = EXCLUDED.nombre,
                   rol = EXCLUDED.rol,
                   activo = EXCLUDED.activo
                 RETURNING *`,
                [nombre, rol, correo, activo]
              );
              res.end(JSON.stringify({ data: mapUsuario(rows[0]) }));
              return;
            }
            if (action === 'update') {
              const str = String(id || '').trim();
              const isEmail = str.includes('@');
              const { rows: cur } = await db.query(
                isEmail
                  ? 'SELECT * FROM public.usuario WHERE LOWER(correo) = LOWER($1)'
                  : 'SELECT * FROM public.usuario WHERE id_usuario = $1',
                [isEmail ? str : Number(str)]
              );
              if (!cur[0]) {
                res.end(JSON.stringify({ data: null }));
                return;
              }
              const c = cur[0];
              const { rows } = await db.query(
                `UPDATE public.usuario SET
                  nombre = $1, rol = $2, activo = $3
                 WHERE id_usuario = $4 RETURNING *`,
                [
                  data.full_name ?? data.name ?? c.nombre,
                  data.role ?? c.rol,
                  data.is_active !== undefined ? Boolean(data.is_active) : c.activo,
                  c.id_usuario,
                ]
              );
              res.end(JSON.stringify({ data: mapUsuario(rows[0]) }));
              return;
            }
            if (action === 'delete') {
              const str = String(id || '').trim();
              const isEmail = str.includes('@');
              await db.query(
                isEmail
                  ? 'DELETE FROM public.usuario WHERE LOWER(correo) = LOWER($1)'
                  : 'DELETE FROM public.usuario WHERE id_usuario = $1',
                [isEmail ? str : Number(str)]
              );
              res.end(JSON.stringify({ data: true }));
              return;
            }
          }

          res.statusCode = 400;
          res.end(JSON.stringify({ error: `Unsupported operation: ${entity}.${action}` }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

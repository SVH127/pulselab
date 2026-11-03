/**
 * Script repetible de migración de datos de Firestore a PostgreSQL / Supabase (Paso 11 del plan)
 */

import fs from 'node:fs';
import { getPostgresClient } from './db-connection.js';

const BACKUP_JSON_PATH = process.env.BACKUP_JSON_PATH || './firestore-backup.json';

const toNum = (v) => {
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function migrateFromBackup(data, client) {
  const summary = {
    usuarios: 0,
    casos: 0,
    preguntas: 0,
    resultados: 0,
    respuestas: 0,
    omitidos: 0,
  };

  await client.exec('BEGIN');
  try {
    // 1. Unificar usuarios (pending_users + student_accounts + users)
    const usersByEmail = new Map();
    for (const src of [
      ...(data.pending_users || []),
      ...(data.student_accounts || []),
      ...(data.users || []),
    ]) {
      const correo = String(src.email || src.id || '').trim().toLowerCase();
      if (!correo || !correo.includes('@')) continue;
      const prev = usersByEmail.get(correo) || {};
      usersByEmail.set(correo, {
        correo,
        nombre: src.full_name || src.name || prev.nombre || correo,
        rol: src.role === 'admin' || prev.rol === 'admin' ? 'admin' : 'student',
        activo: src.is_active !== false && prev.activo !== false,
        firebase_uid:
          src.id && !String(src.id).includes('@') ? String(src.id) : prev.firebase_uid || null,
        fecha_registro: src.created_date || prev.fecha_registro || new Date().toISOString(),
      });
    }

    const emailToUserId = new Map();
    for (const u of usersByEmail.values()) {
      const { rows } = await client.query(
        `
        INSERT INTO public.usuario (nombre, rol, correo, activo, firebase_uid, fecha_registro)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (correo) DO UPDATE SET
          nombre = EXCLUDED.nombre,
          rol = EXCLUDED.rol,
          activo = EXCLUDED.activo,
          firebase_uid = COALESCE(EXCLUDED.firebase_uid, public.usuario.firebase_uid)
        RETURNING id_usuario, correo;
        `,
        [u.nombre, u.rol, u.correo, u.activo, u.firebase_uid, u.fecha_registro]
      );
      emailToUserId.set(rows[0].correo, rows[0].id_usuario);
      summary.usuarios += 1;
    }

    // 2. Migrar clinical_cases -> caso_clinico + pregunta
    const legacyCaseToId = new Map();
    const caseQuestionsMap = new Map();

    for (const c of data.clinical_cases || []) {
      const legacyId = String(c.id || '');
      if (!c.title) {
        summary.omitidos += 1;
        continue;
      }

      const { rows } = await client.query(
        `
        INSERT INTO public.caso_clinico (
          legacy_firebase_id, titulo, descripcion, nombre_paciente, edad_paciente,
          peso_paciente, talla_paciente, imc, estado, fecha_creacion,
          fc, fr, spo2, pa_sistolica, pa_diastolica, temperatura, duracion_minutos
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        ON CONFLICT (legacy_firebase_id) DO UPDATE SET
          titulo = EXCLUDED.titulo,
          estado = EXCLUDED.estado
        RETURNING id_caso_clinico;
        `,
        [
          legacyId || null,
          c.title,
          c.description || null,
          c.patient_name || null,
          toNum(c.patient_age),
          toNum(c.patient_weight),
          toNum(c.patient_height),
          toNum(c.patient_bmi),
          c.status === 'published' ? 'published' : 'draft',
          c.created_date || new Date().toISOString(),
          toNum(c.fc),
          toNum(c.fr),
          toNum(c.spo2),
          toNum(c.pa_systolic),
          toNum(c.pa_diastolic),
          toNum(c.temperature),
          toNum(c.duration_minutes),
        ]
      );

      const idCaso = rows[0].id_caso_clinico;
      if (legacyId) legacyCaseToId.set(legacyId, idCaso);
      summary.casos += 1;

      await client.query(
        'DELETE FROM public.pregunta WHERE caso_clinico_id_caso_clinico = $1',
        [idCaso]
      );

      const qIds = [];
      const questions = Array.isArray(c.questions) ? c.questions : [];
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const { rows: qRows } = await client.query(
          `
          INSERT INTO public.pregunta (
            texto, retroalimentacion, orden,
            opcion_a, opcion_b, opcion_c, opcion_d,
            concepto, opcion_correcta, caso_clinico_id_caso_clinico
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          RETURNING id_pregunta;
          `,
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
        qIds.push(qRows[0].id_pregunta);
        summary.preguntas += 1;
      }
      caseQuestionsMap.set(idCaso, qIds);
    }

    // 3. Migrar student_results -> resultado + respuesta_alumno
    for (const r of data.student_results || []) {
      const email = String(r.student_email || '').trim().toLowerCase();
      if (!email) {
        summary.omitidos += 1;
        continue;
      }

      let idUsuario = emailToUserId.get(email);
      if (!idUsuario) {
        const { rows: uRows } = await client.query(
          `
          INSERT INTO public.usuario (nombre, rol, correo, activo)
          VALUES ($1, 'student', $2, TRUE)
          ON CONFLICT (correo) DO UPDATE SET nombre = EXCLUDED.nombre
          RETURNING id_usuario;
          `,
          [r.student_name || email, email]
        );
        idUsuario = uRows[0].id_usuario;
        emailToUserId.set(email, idUsuario);
        summary.usuarios += 1;
      }

      const idCaso = legacyCaseToId.get(String(r.case_id || ''));
      if (!idCaso) {
        summary.omitidos += 1;
        continue;
      }

      const legacyResultId = String(r.id || '');
      const { rows: resRows } = await client.query(
        `
        INSERT INTO public.resultado (
          legacy_firebase_id, tiempo_usado_segundos, total_preguntas,
          comodin_usado, aciertos, porcentaje, fecha_completado,
          usuario_id_usuario, caso_clinico_id_caso_clinico
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (legacy_firebase_id) DO UPDATE SET
          aciertos = EXCLUDED.aciertos,
          porcentaje = EXCLUDED.porcentaje
        RETURNING id_resultado;
        `,
        [
          legacyResultId || null,
          Number(r.time_used_seconds || 0),
          Number(r.total_questions || 0),
          Boolean(r.wildcard_used),
          Number(r.correct_count || 0),
          Number(r.percentage || 0),
          r.completed_at || r.created_date || new Date().toISOString(),
          idUsuario,
          idCaso,
        ]
      );

      const idResultado = resRows[0].id_resultado;
      summary.resultados += 1;

      await client.query(
        'DELETE FROM public.respuesta_alumno WHERE resultado_id_resultado = $1',
        [idResultado]
      );

      const qIds = caseQuestionsMap.get(idCaso) || [];
      const answers = Array.isArray(r.answers) ? r.answers : [];
      for (let i = 0; i < answers.length; i++) {
        const ans = answers[i];
        const qIdx = Number(ans.question_index ?? i);
        const idPregunta = qIds[qIdx];
        if (!idPregunta) continue;

        await client.query(
          `
          INSERT INTO public.respuesta_alumno (
            opcion_seleccionada, es_correcta, tiempo_agotado,
            resultado_id_resultado, pregunta_id_pregunta
          )
          VALUES ($1,$2,$3,$4,$5)
          ON CONFLICT (resultado_id_resultado, pregunta_id_pregunta) DO NOTHING;
          `,
          [
            ans.selected_option
              ? String(ans.selected_option).trim().toLowerCase().slice(0, 1)
              : null,
            Boolean(ans.is_correct),
            Boolean(ans.timed_out),
            idResultado,
            idPregunta,
          ]
        );
        summary.respuestas += 1;
      }
    }

    await client.exec('COMMIT');
    console.log('✅ Migración completada con éxito. Resumen:', summary);
  } catch (err) {
    await client.exec('ROLLBACK');
    throw err;
  }
}

async function main() {
  if (!fs.existsSync(BACKUP_JSON_PATH)) {
    console.log(`ℹ️ No se encontró ${BACKUP_JSON_PATH}. Creando un ejemplo de respaldo para pruebas...`);
    const sampleBackup = {
      users: [
        { id: 'uid_admin_1', email: 'vazquezhernandezsebastian1@gmail.com', full_name: 'Sebastián Vázquez', role: 'admin', is_active: true },
      ],
      pending_users: [
        { id: 'alumno1@pulselab.edu.mx', email: 'alumno1@pulselab.edu.mx', full_name: 'Alumno Migrado Firebase', role: 'student', is_active: true },
      ],
      student_accounts: [],
      clinical_cases: [
        {
          id: 'firebase_case_001',
          title: 'Choque Hipovolémico en Urgencias (Migrado de Firestore)',
          status: 'published',
          patient_name: 'Roberto Díaz',
          patient_age: 42,
          patient_weight: 80,
          patient_height: 175,
          patient_bmi: 26.1,
          fc: 128,
          fr: 24,
          spo2: 91,
          pa_systolic: 85,
          pa_diastolic: 50,
          temperature: 36.1,
          duration_minutes: 15,
          questions: [
            {
              text: '¿Cuál es el signo clínico temprano más frecuente en el choque hipovolémico?',
              option_a: 'Bradicardia sinusal',
              option_b: 'Taquicardia compensatoria',
              option_c: 'Hipertensión arterial',
              option_d: 'Hipertermia',
              correct_option: 'b',
              feedback: 'La taquicardia es el primer mecanismo compensatorio simpático para mantener el gasto cardíaco.',
              concept: 'Fisiopatología del estado de choque',
            },
          ],
        },
      ],
      student_results: [
        {
          id: 'firebase_res_001',
          student_email: 'alumno1@pulselab.edu.mx',
          student_name: 'Alumno Migrado Firebase',
          case_id: 'firebase_case_001',
          case_title: 'Choque Hipovolémico en Urgencias (Migrado de Firestore)',
          correct_count: 1,
          total_questions: 1,
          time_used_seconds: 55,
          percentage: 100,
          wildcard_used: false,
          completed_at: new Date().toISOString(),
          answers: [
            { question_index: 0, selected_option: 'b', is_correct: true, timed_out: false },
          ],
        },
      ],
    };
    fs.writeFileSync(BACKUP_JSON_PATH, JSON.stringify(sampleBackup, null, 2), 'utf8');
  }

  const raw = fs.readFileSync(BACKUP_JSON_PATH, 'utf8');
  const data = JSON.parse(raw);

  const client = await getPostgresClient();
  console.log('✅ Conectado a:', client.mode);
  try {
    await migrateFromBackup(data, client);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ Error en script de migración:', err);
  process.exit(1);
});

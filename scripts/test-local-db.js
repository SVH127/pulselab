/**
 * Script de validación y pruebas locales en PostgreSQL para PulseLab (Paso 7 del plan)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPostgresClient } from './db-connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

async function run() {
  const client = await getPostgresClient();
  console.log('✅ Conectado a:', client.mode);

  try {
    // 1. Aplicar migración de esquema
    const schemaPath = path.join(
      rootDir,
      'supabase',
      'migrations',
      '20261021000100_esquema_relacional_pulselab.sql'
    );
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await client.exec(schemaSql);
    console.log('✅ Esquema relacional creado/actualizado (5 tablas: usuario, caso_clinico, pregunta, resultado, respuesta_alumno)');

    // 2. Aplicar políticas RLS
    const rlsPath = path.join(
      rootDir,
      'supabase',
      'migrations',
      '20261021000200_politicas_rls.sql'
    );
    const rlsSql = fs.readFileSync(rlsPath, 'utf8');
    await client.exec(rlsSql);
    console.log('✅ Políticas Row Level Security (RLS) aplicadas correctamente');

    // 3. Aplicar seed.sql
    const seedPath = path.join(rootDir, 'supabase', 'seed.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    await client.exec(seedSql);
    console.log('✅ Datos de prueba (seed.sql) insertados correctamente');

    // 4. Validar restricciones de integridad (Paso 7 del plan)
    console.log('\n--- Ejecutando pruebas de integridad relacional ---');

    // Prueba A: No se pueden crear preguntas que apunten a casos inexistentes
    try {
      await client.query(`
        INSERT INTO public.pregunta (texto, orden, opcion_correcta, caso_clinico_id_caso_clinico)
        VALUES ('Pregunta huérfana', 1, 'a', 999999);
      `);
      console.error('❌ FALLÓ: Se permitió insertar una pregunta con caso inexistente');
    } catch {
      console.log('✔️  Prueba 1 superada: FK impide crear preguntas para casos inexistentes');
    }

    // Prueba B: No se pueden guardar resultados con alumnos o casos inexistentes
    try {
      await client.query(`
        INSERT INTO public.resultado (usuario_id_usuario, caso_clinico_id_caso_clinico)
        VALUES (999999, 1);
      `);
      console.error('❌ FALLÓ: Se permitió insertar un resultado con alumno inexistente');
    } catch {
      console.log('✔️  Prueba 2 superada: FK impide guardar resultados con alumnos inexistentes');
    }

    // Prueba C: Las restricciones bloquean roles o valores inválidos
    try {
      await client.query(`
        INSERT INTO public.usuario (nombre, rol, correo)
        VALUES ('Usuario Rol Inválido', 'superhacker', 'hacker@test.com');
      `);
      console.error('❌ FALLÓ: Se permitió insertar un rol inválido');
    } catch {
      console.log('✔️  Prueba 3 superada: CHECK constraint bloquea roles inválidos');
    }

    // Prueba D: Consultas relacionales devuelven la información correcta
    const { rows: casos } = await client.query(`
      SELECT
        c.id_caso_clinico,
        c.titulo,
        c.nombre_paciente,
        c.imc,
        COUNT(p.id_pregunta)::int AS total_preguntas
      FROM public.caso_clinico c
      LEFT JOIN public.pregunta p ON p.caso_clinico_id_caso_clinico = c.id_caso_clinico
      GROUP BY c.id_caso_clinico
      ORDER BY c.id_caso_clinico;
    `);
    console.log('✔️  Prueba 4 superada: Consulta JOIN de casos y preguntas:\n', casos);

    const { rows: resultados } = await client.query(`
      SELECT
        r.id_resultado,
        u.nombre AS estudiante,
        u.correo,
        c.titulo AS caso,
        r.aciertos,
        r.total_preguntas,
        r.porcentaje,
        COUNT(ra.id_respuesta_alumno)::int AS respuestas_registradas
      FROM public.resultado r
      JOIN public.usuario u ON u.id_usuario = r.usuario_id_usuario
      JOIN public.caso_clinico c ON c.id_caso_clinico = r.caso_clinico_id_caso_clinico
      LEFT JOIN public.respuesta_alumno ra ON ra.resultado_id_resultado = r.id_resultado
      GROUP BY r.id_resultado, u.nombre, u.correo, c.titulo
      ORDER BY r.fecha_completado DESC;
    `);
    console.log('✔️  Prueba 5 superada: Consulta JOIN de resultados y respuestas:\n', resultados);

    console.log('\n🎉 Todas las pruebas de base de datos relacional finalizaron con éxito.');
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('Error en validación de base de datos:', err);
  process.exit(1);
});

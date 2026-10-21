-- =============================================================================
-- PulseLab - Datos de prueba (Seed SQL) para validación local
-- =============================================================================

BEGIN;

-- 1. Usuarios de prueba (1 docente/admin + 2 estudiantes)
INSERT INTO public.usuario (id_usuario, nombre, rol, correo, activo)
VALUES
  (1, 'Sebastián Vázquez (Admin)', 'admin', 'vazquezhernandezsebastian1@gmail.com', TRUE),
  (2, 'Ana Sofía Martínez', 'student', 'ana.martinez@alumno.pulselab.edu.mx', TRUE),
  (3, 'Carlos Eduardo López', 'student', 'carlos.lopez@alumno.pulselab.edu.mx', TRUE)
ON CONFLICT (id_usuario) DO NOTHING;

SELECT setval(pg_get_serial_sequence('public.usuario', 'id_usuario'), COALESCE((SELECT MAX(id_usuario) FROM public.usuario), 1));

-- 2. Caso clínico de prueba
INSERT INTO public.caso_clinico (
  id_caso_clinico, titulo, descripcion, nombre_paciente, edad_paciente,
  peso_paciente, talla_paciente, imc, estado, fc, fr, spo2,
  pa_sistolica, pa_diastolica, temperatura, duracion_minutos, usuario_id_usuario
)
VALUES (
  1,
  'Paciente con Insuficiencia Cardíaca Aguda Descompensada',
  'Paciente femenina que ingresa a urgencias por disnea progresiva y edema en miembros inferiores.',
  'María García Hernández',
  68,
  74.00,
  158.00,
  29.64,
  'published',
  112,
  26,
  89,
  155,
  95,
  36.7,
  10,
  1
)
ON CONFLICT (id_caso_clinico) DO NOTHING;

SELECT setval(pg_get_serial_sequence('public.caso_clinico', 'id_caso_clinico'), COALESCE((SELECT MAX(id_caso_clinico) FROM public.caso_clinico), 1));

-- 3. Preguntas del caso clínico 1
INSERT INTO public.pregunta (
  id_pregunta, texto, retroalimentacion, orden,
  opcion_a, opcion_b, opcion_c, opcion_d,
  concepto, opcion_correcta, caso_clinico_id_caso_clinico
)
VALUES
  (
    1,
    'Ante una SpO2 de 89% y FR de 26 rpm, ¿cuál es la intervención prioritaria de enfermería?',
    'La respuesta correcta es B: Colocar en posición Fowler alta y administrar oxígeno suplementario. Mejora la expansión pulmonar y corrige la hipoxemia aguda.',
    1,
    'Administrar bolo rápido de solución salina al 0.9%',
    'Colocar en posición Fowler alta y administrar oxígeno suplementario',
    'Dejar en decúbito supino estricto y repetir signos en 1 hora',
    'Suspender la monitorización electrocardiográfica',
    'Oxigenoterapia y manejo de la disnea aguda',
    'b',
    1
  ),
  (
    2,
    '¿Qué grupo farmacológico se indica de primera línea para reducir la congestión pulmonar en este escenario?',
    'La respuesta correcta es A: Diuréticos de asa intravenosos (ej. furosemida), ya que disminuyen la precarga y el edema pulmonar.',
    2,
    'Diuréticos de asa por vía intravenosa (furosemida)',
    'Betabloqueadores a dosis altas de inicio agudo',
    'Antiinflamatorios no esteroideos (AINEs)',
    'Anticoagulantes orales de acción lenta',
    'Farmacología cardiovascular en urgencias',
    'a',
    1
  )
ON CONFLICT (id_pregunta) DO NOTHING;

SELECT setval(pg_get_serial_sequence('public.pregunta', 'id_pregunta'), COALESCE((SELECT MAX(id_pregunta) FROM public.pregunta), 1));

-- 4. Resultado de prueba de Ana Sofía en el Caso 1
INSERT INTO public.resultado (
  id_resultado, tiempo_usado_segundos, total_preguntas, comodin_usado,
  aciertos, porcentaje, usuario_id_usuario, caso_clinico_id_caso_clinico
)
VALUES (
  1, 145, 2, FALSE, 2, 100.00, 2, 1
)
ON CONFLICT (id_resultado) DO NOTHING;

SELECT setval(pg_get_serial_sequence('public.resultado', 'id_resultado'), COALESCE((SELECT MAX(id_resultado) FROM public.resultado), 1));

-- 5. Respuestas individuales del intento 1
INSERT INTO public.respuesta_alumno (
  id_respuesta_alumno, opcion_seleccionada, es_correcta, tiempo_agotado,
  resultado_id_resultado, pregunta_id_pregunta
)
VALUES
  (1, 'b', TRUE, FALSE, 1, 1),
  (2, 'a', TRUE, FALSE, 1, 2)
ON CONFLICT (id_respuesta_alumno) DO NOTHING;

SELECT setval(pg_get_serial_sequence('public.respuesta_alumno', 'id_respuesta_alumno'), COALESCE((SELECT MAX(id_respuesta_alumno) FROM public.respuesta_alumno), 1));

COMMIT;

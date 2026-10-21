import { supabase } from '@/api/supabaseClient';

// ============================================================================
// Mapeadores entre el modelo relacional en español (Diagrama_ER) y el frontend
// ============================================================================

const mapUsuarioToFrontend = (row) => {
  if (!row) return null;
  return {
    id: String(row.id_usuario),
    id_usuario: row.id_usuario,
    email: row.correo,
    full_name: row.nombre,
    name: row.nombre,
    role: row.rol,
    is_active: row.activo !== false,
    created_date: row.fecha_registro,
  };
};

const mapPreguntaToFrontend = (row) => ({
  id: String(row.id_pregunta),
  id_pregunta: row.id_pregunta,
  text: row.texto || '',
  option_a: row.opcion_a || '',
  option_b: row.opcion_b || '',
  option_c: row.opcion_c || '',
  option_d: row.opcion_d || '',
  correct_option: (row.opcion_correcta || 'a').trim().toLowerCase(),
  feedback: row.retroalimentacion || '',
  concept: row.concepto || '',
  order: row.orden,
});

const mapCasoToFrontend = (row) => {
  if (!row) return null;
  const preguntasOrdenadas = [...(row.pregunta || [])].sort(
    (a, b) => (a.orden ?? 0) - (b.orden ?? 0)
  );
  return {
    id: String(row.id_caso_clinico),
    id_caso_clinico: row.id_caso_clinico,
    title: row.titulo || '',
    description: row.descripcion || '',
    status: row.estado || 'draft',
    patient_name: row.nombre_paciente || '',
    patient_age: row.edad_paciente ?? '',
    patient_weight: row.peso_paciente !== null && row.peso_paciente !== undefined ? Number(row.peso_paciente) : '',
    patient_height: row.talla_paciente !== null && row.talla_paciente !== undefined ? Number(row.talla_paciente) : '',
    patient_bmi: row.imc !== null && row.imc !== undefined ? Number(row.imc) : '',
    fc: row.fc ?? '',
    fr: row.fr ?? '',
    spo2: row.spo2 ?? '',
    pa_systolic: row.pa_sistolica ?? '',
    pa_diastolic: row.pa_diastolica ?? '',
    temperature: row.temperatura !== null && row.temperatura !== undefined ? Number(row.temperatura) : '',
    duration_minutes: row.duracion_minutos ?? '',
    created_date: row.fecha_creacion,
    questions: preguntasOrdenadas.map(mapPreguntaToFrontend),
  };
};

const mapResultadoToFrontend = (row) => {
  if (!row) return null;
  const respuestasOrdenadas = [...(row.respuesta_alumno || [])].sort(
    (a, b) => (a.pregunta?.orden ?? 0) - (b.pregunta?.orden ?? 0)
  );
  return {
    id: String(row.id_resultado),
    id_resultado: row.id_resultado,
    student_email: row.usuario?.correo || '',
    student_name: row.usuario?.nombre || '',
    case_id: String(row.caso_clinico_id_caso_clinico),
    case_title: row.caso_clinico?.titulo || '',
    correct_count: row.aciertos ?? 0,
    total_questions: row.total_preguntas ?? 0,
    time_used_seconds: row.tiempo_usado_segundos ?? 0,
    percentage: row.porcentaje !== null && row.porcentaje !== undefined ? Math.round(Number(row.porcentaje)) : 0,
    completed_at: row.fecha_completado,
    created_date: row.fecha_completado,
    wildcard_used: Boolean(row.comodin_usado),
    answers: respuestasOrdenadas.map((ans, idx) => ({
      question_index: ans.pregunta?.orden ? ans.pregunta.orden - 1 : idx,
      selected_option: ans.opcion_seleccionada ? ans.opcion_seleccionada.trim().toLowerCase() : null,
      is_correct: Boolean(ans.es_correcta),
      timed_out: Boolean(ans.tiempo_agotado),
    })),
  };
};

const toNumberOrNull = (val) => {
  if (val === '' || val === undefined || val === null) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
};

// ============================================================================
// Entidad: Usuario (unifica User, PendingUser y StudentAccount en tabla usuario)
// ============================================================================

const createUsuarioEntity = (defaultRoleFilter = null) => ({
  list: async (sortBy = '-created_date') => {
    const ascending = !sortBy?.startsWith('-');
    let query = supabase
      .from('usuario')
      .select('*')
      .order('fecha_registro', { ascending });

    if (defaultRoleFilter === 'student') {
      query = query.in('rol', ['student', 'user']);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapUsuarioToFrontend);
  },

  get: async (idOrEmail) => {
    if (!idOrEmail) throw new Error('usuario id is required');
    const str = String(idOrEmail).trim();
    let query = supabase.from('usuario').select('*');

    if (str.includes('@')) {
      query = query.eq('correo', str.toLowerCase());
    } else if (/^\d+$/.test(str)) {
      query = query.eq('id_usuario', Number(str));
    } else {
      query = query.eq('firebase_uid', str);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('usuario not found');
    return mapUsuarioToFrontend(data);
  },

  filter: async (criteria = {}) => {
    let query = supabase.from('usuario').select('*');
    if (criteria.email) {
      query = query.eq('correo', String(criteria.email).trim().toLowerCase());
    }
    if (criteria.role) {
      query = query.eq('rol', criteria.role);
    }
    if (criteria.is_active !== undefined) {
      query = query.eq('activo', Boolean(criteria.is_active));
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapUsuarioToFrontend);
  },

  create: async (payload) => {
    const correo = String(payload.email || payload.id || '').trim().toLowerCase();
    const nombre = (payload.full_name || payload.name || correo).trim();
    const rol = payload.role || defaultRoleFilter || 'student';
    const activo = payload.is_active !== false;
    const firebase_uid =
      payload.id && !String(payload.id).includes('@') && !/^\d+$/.test(String(payload.id))
        ? String(payload.id)
        : undefined;

    const upsertRow = {
      correo,
      nombre,
      rol,
      activo,
      ...(firebase_uid ? { firebase_uid } : {}),
    };

    const { data, error } = await supabase
      .from('usuario')
      .upsert(upsertRow, { onConflict: 'correo' })
      .select('*')
      .single();

    if (error) throw error;
    return mapUsuarioToFrontend(data);
  },

  update: async (idOrEmail, payload) => {
    const str = String(idOrEmail).trim();
    const updates = {};
    if (payload.full_name !== undefined || payload.name !== undefined) {
      updates.nombre = payload.full_name ?? payload.name;
    }
    if (payload.role !== undefined) updates.rol = payload.role;
    if (payload.is_active !== undefined) updates.activo = Boolean(payload.is_active);
    if (payload.email !== undefined) updates.correo = String(payload.email).trim().toLowerCase();

    let query = supabase.from('usuario').update(updates);
    if (str.includes('@')) {
      query = query.eq('correo', str.toLowerCase());
    } else if (/^\d+$/.test(str)) {
      query = query.eq('id_usuario', Number(str));
    } else {
      query = query.eq('firebase_uid', str);
    }

    const { data, error } = await query.select('*').maybeSingle();
    if (error) throw error;
    return mapUsuarioToFrontend(data);
  },

  delete: async (idOrEmail) => {
    const str = String(idOrEmail).trim();
    let query = supabase.from('usuario').delete();
    if (str.includes('@')) {
      query = query.eq('correo', str.toLowerCase());
    } else if (/^\d+$/.test(str)) {
      query = query.eq('id_usuario', Number(str));
    } else {
      query = query.eq('firebase_uid', str);
    }
    const { error } = await query;
    if (error) throw error;
    return true;
  },
});

// ============================================================================
// Entidad: ClinicalCase (tablas caso_clinico + pregunta)
// ============================================================================

const syncPreguntas = async (idCasoClinico, questions = []) => {
  await supabase
    .from('pregunta')
    .delete()
    .eq('caso_clinico_id_caso_clinico', idCasoClinico);

  if (!questions.length) return;

  const rows = questions.map((q, idx) => ({
    caso_clinico_id_caso_clinico: idCasoClinico,
    orden: idx + 1,
    texto: q.text || '',
    opcion_a: q.option_a || '',
    opcion_b: q.option_b || '',
    opcion_c: q.option_c || '',
    opcion_d: q.option_d || '',
    opcion_correcta: (q.correct_option || 'a').trim().toLowerCase().slice(0, 1),
    retroalimentacion: q.feedback || null,
    concepto: q.concept || null,
  }));

  const { error } = await supabase.from('pregunta').insert(rows);
  if (error) throw error;
};

export const supabaseEntities = {
  ClinicalCase: {
    list: async (sortBy = '-created_date') => {
      const ascending = !sortBy?.startsWith('-');
      const { data, error } = await supabase
        .from('caso_clinico')
        .select('*, pregunta(*)')
        .order('fecha_creacion', { ascending });

      if (error) throw error;
      return (data || []).map(mapCasoToFrontend);
    },

    get: async (id) => {
      const { data, error } = await supabase
        .from('caso_clinico')
        .select('*, pregunta(*)')
        .eq('id_caso_clinico', Number(id))
        .single();

      if (error) throw error;
      return mapCasoToFrontend(data);
    },

    filter: async (criteria = {}, sortBy = '-created_date') => {
      const ascending = !sortBy?.startsWith('-');
      let query = supabase
        .from('caso_clinico')
        .select('*, pregunta(*)')
        .order('fecha_creacion', { ascending });

      if (criteria.status) {
        query = query.eq('estado', criteria.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapCasoToFrontend);
    },

    create: async (payload) => {
      const casoRow = {
        titulo: payload.title,
        descripcion: payload.description || null,
        estado: payload.status || 'draft',
        nombre_paciente: payload.patient_name || null,
        edad_paciente: toNumberOrNull(payload.patient_age),
        peso_paciente: toNumberOrNull(payload.patient_weight),
        talla_paciente: toNumberOrNull(payload.patient_height),
        imc: toNumberOrNull(payload.patient_bmi),
        fc: toNumberOrNull(payload.fc),
        fr: toNumberOrNull(payload.fr),
        spo2: toNumberOrNull(payload.spo2),
        pa_sistolica: toNumberOrNull(payload.pa_systolic),
        pa_diastolica: toNumberOrNull(payload.pa_diastolic),
        temperatura: toNumberOrNull(payload.temperature),
        duracion_minutos: toNumberOrNull(payload.duration_minutes),
      };

      const { data, error } = await supabase
        .from('caso_clinico')
        .insert(casoRow)
        .select('*')
        .single();

      if (error) throw error;

      if (Array.isArray(payload.questions)) {
        await syncPreguntas(data.id_caso_clinico, payload.questions);
      }

      return supabaseEntities.ClinicalCase.get(data.id_caso_clinico);
    },

    update: async (id, payload) => {
      const idCaso = Number(id);
      const updates = {};

      if (payload.title !== undefined) updates.titulo = payload.title;
      if (payload.description !== undefined) updates.descripcion = payload.description || null;
      if (payload.status !== undefined) updates.estado = payload.status;
      if (payload.patient_name !== undefined) updates.nombre_paciente = payload.patient_name || null;
      if ('patient_age' in payload) updates.edad_paciente = toNumberOrNull(payload.patient_age);
      if ('patient_weight' in payload) updates.peso_paciente = toNumberOrNull(payload.patient_weight);
      if ('patient_height' in payload) updates.talla_paciente = toNumberOrNull(payload.patient_height);
      if ('patient_bmi' in payload) updates.imc = toNumberOrNull(payload.patient_bmi);
      if ('fc' in payload) updates.fc = toNumberOrNull(payload.fc);
      if ('fr' in payload) updates.fr = toNumberOrNull(payload.fr);
      if ('spo2' in payload) updates.spo2 = toNumberOrNull(payload.spo2);
      if ('pa_systolic' in payload) updates.pa_sistolica = toNumberOrNull(payload.pa_systolic);
      if ('pa_diastolica' in payload || 'pa_diastolic' in payload) {
        updates.pa_diastolica = toNumberOrNull(payload.pa_diastolic);
      }
      if ('temperature' in payload) updates.temperatura = toNumberOrNull(payload.temperature);
      if ('duration_minutes' in payload) updates.duracion_minutos = toNumberOrNull(payload.duration_minutes);

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('caso_clinico')
          .update(updates)
          .eq('id_caso_clinico', idCaso);

        if (error) throw error;
      }

      if (Array.isArray(payload.questions)) {
        await syncPreguntas(idCaso, payload.questions);
      }

      return supabaseEntities.ClinicalCase.get(idCaso);
    },

    delete: async (id) => {
      const { error } = await supabase
        .from('caso_clinico')
        .delete()
        .eq('id_caso_clinico', Number(id));
      if (error) throw error;
      return true;
    },
  },

  StudentResult: {
    list: async (sortBy = '-completed_at') => {
      const ascending = !sortBy?.startsWith('-');
      const { data, error } = await supabase
        .from('resultado')
        .select(`
          *,
          usuario ( id_usuario, nombre, correo ),
          caso_clinico ( id_caso_clinico, titulo ),
          respuesta_alumno (
            id_respuesta_alumno,
            opcion_seleccionada,
            es_correcta,
            tiempo_agotado,
            pregunta_id_pregunta,
            pregunta ( id_pregunta, orden )
          )
        `)
        .order('fecha_completado', { ascending });

      if (error) throw error;
      return (data || []).map(mapResultadoToFrontend);
    },

    filter: async (criteria = {}, sortBy = '-completed_at') => {
      const all = await supabaseEntities.StudentResult.list(sortBy);
      return all.filter((r) =>
        Object.entries(criteria).every(([k, v]) => r[k] === v)
      );
    },

    create: async (payload) => {
      const email = String(payload.student_email || '').trim().toLowerCase();
      let { data: userRow } = await supabase
        .from('usuario')
        .select('id_usuario')
        .eq('correo', email)
        .maybeSingle();

      if (!userRow) {
        const { data: createdUser, error: userErr } = await supabase
          .from('usuario')
          .insert({
            correo: email,
            nombre: payload.student_name || email,
            rol: 'student',
            activo: true,
          })
          .select('id_usuario')
          .single();
        if (userErr) throw userErr;
        userRow = createdUser;
      }

      const idCaso = Number(payload.case_id);
      const { data: resultRow, error: resErr } = await supabase
        .from('resultado')
        .insert({
          tiempo_usado_segundos: Number(payload.time_used_seconds || 0),
          total_preguntas: Number(payload.total_questions || 0),
          comodin_usado: Boolean(payload.wildcard_used),
          aciertos: Number(payload.correct_count || 0),
          porcentaje: Number(payload.percentage || 0),
          fecha_completado: payload.completed_at || new Date().toISOString(),
          usuario_id_usuario: userRow.id_usuario,
          caso_clinico_id_caso_clinico: idCaso,
        })
        .select('*')
        .single();

      if (resErr) throw resErr;

      if (Array.isArray(payload.answers) && payload.answers.length > 0) {
        const { data: preguntas } = await supabase
          .from('pregunta')
          .select('id_pregunta, orden')
          .eq('caso_clinico_id_caso_clinico', idCaso)
          .order('orden', { ascending: true });

        if (preguntas && preguntas.length > 0) {
          const respuestasRows = payload.answers
            .map((ans, idx) => {
              const qIndex = Number(ans.question_index ?? idx);
              const targetPregunta =
                preguntas.find((p) => p.orden === qIndex + 1) || preguntas[qIndex];
              if (!targetPregunta) return null;
              return {
                resultado_id_resultado: resultRow.id_resultado,
                pregunta_id_pregunta: targetPregunta.id_pregunta,
                opcion_seleccionada: ans.selected_option
                  ? String(ans.selected_option).trim().toLowerCase().slice(0, 1)
                  : null,
                es_correcta: Boolean(ans.is_correct),
                tiempo_agotado: Boolean(ans.timed_out),
              };
            })
            .filter(Boolean);

          if (respuestasRows.length > 0) {
            const { error: ansErr } = await supabase
              .from('respuesta_alumno')
              .insert(respuestasRows);
            if (ansErr) throw ansErr;
          }
        }
      }

      return resultRow;
    },
  },

  User: createUsuarioEntity(null),
  PendingUser: createUsuarioEntity(null),
  StudentAccount: createUsuarioEntity('student'),
};

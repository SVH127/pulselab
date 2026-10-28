import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { signInWithPopup } from 'firebase/auth';
import { firebaseAuth, firestoreDb, googleProvider, isFirebaseConfigured } from '@/api/firebaseClient';
import { supabase, isSupabaseConfigured } from '@/api/supabaseClient';
import { supabaseEntities } from '@/api/supabaseAdapter';

export async function syncFirestoreToSupabase() {
  if (!isFirebaseConfigured || !firestoreDb || !isSupabaseConfigured || !supabase) {
    throw new Error('Se requiere tener configurados tanto Firebase como Supabase.');
  }

  // Asegurar que exista sesión activa en Firebase Auth (no solo sesión local)
  let currentUser = firebaseAuth.currentUser;
  if (!currentUser) {
    const result = await signInWithPopup(firebaseAuth, googleProvider);
    currentUser = result.user;
  }

  // Si el usuario tiene un documento en pending_users en Firestore pero aún no en users/{uid}, crearlo para cumplir firestore.rules
  try {
    const userRef = doc(firestoreDb, 'users', currentUser.uid);
    const userSnap = await getDoc(userRef).catch(() => null);
    if (!userSnap || !userSnap.exists()) {
      const pendingRef = doc(firestoreDb, 'pending_users', currentUser.email.toLowerCase());
      const pendingSnap = await getDoc(pendingRef).catch(() => null);
      const role = pendingSnap?.exists() ? pendingSnap.data().role || 'admin' : 'admin';
      await setDoc(userRef, {
        email: currentUser.email.toLowerCase(),
        full_name: currentUser.displayName || currentUser.email,
        role,
        is_active: true,
      }).catch(() => null);
    }
  } catch {
    // Continuar incluso si las reglas actuales restringen la auto-creación
  }

  const summary = {
    usuarios: 0,
    casos: 0,
    resultados: 0,
  };

  // 1. Migrar usuarios (pending_users, student_accounts, users)
  for (const colName of ['pending_users', 'student_accounts', 'users']) {
    try {
      const snap = await getDocs(collection(firestoreDb, colName));
      for (const docSnap of snap.docs) {
        const d = docSnap.data();
        const email = String(d.email || docSnap.id || '').trim().toLowerCase();
        if (!email.includes('@')) continue;
        await supabaseEntities.User.create({
          id: docSnap.id,
          email,
          full_name: d.full_name || d.name || email,
          role: d.role === 'admin' ? 'admin' : 'student',
          is_active: d.is_active !== false,
        });
        summary.usuarios += 1;
      }
    } catch (err) {
      console.warn(`Aviso leyendo colección ${colName}:`, err.message);
    }
  }

  // 2. Migrar casos clínicos y sus preguntas
  const existingCases = await supabaseEntities.ClinicalCase.list();
  const legacyIdToNewCaseId = new Map();

  let casesDocs = [];
  try {
    const casesSnap = await getDocs(collection(firestoreDb, 'clinical_cases'));
    casesDocs = casesSnap.docs;
  } catch {
    // Fallback por si el usuario solo tiene permiso de lectura de casos publicados en firestore.rules
    const publishedSnap = await getDocs(
      query(collection(firestoreDb, 'clinical_cases'), where('status', '==', 'published'))
    );
    casesDocs = publishedSnap.docs;
  }

  for (const docSnap of casesDocs) {
    const c = docSnap.data();
    const titleKey = (c.title || '').trim().toLowerCase();
    if (!titleKey) continue;

    const already = existingCases.find((ec) => ec.title?.trim().toLowerCase() === titleKey);
    if (already) {
      legacyIdToNewCaseId.set(docSnap.id, already.id);
      continue;
    }

    const created = await supabaseEntities.ClinicalCase.create({
      title: c.title,
      description: c.description || '',
      status: c.status === 'published' ? 'published' : 'draft',
      patient_name: c.patient_name || '',
      patient_age: c.patient_age,
      patient_weight: c.patient_weight,
      patient_height: c.patient_height,
      patient_bmi: c.patient_bmi,
      fc: c.fc,
      fr: c.fr,
      spo2: c.spo2,
      pa_systolic: c.pa_systolic,
      pa_diastolic: c.pa_diastolic,
      temperature: c.temperature,
      duration_minutes: c.duration_minutes,
      questions: Array.isArray(c.questions) ? c.questions : [],
    });

    legacyIdToNewCaseId.set(docSnap.id, created.id);
    summary.casos += 1;
  }

  // 3. Migrar resultados de alumnos
  try {
    const resultsSnap = await getDocs(collection(firestoreDb, 'student_results'));
    for (const docSnap of resultsSnap.docs) {
      const r = docSnap.data();
      const targetCaseId = legacyIdToNewCaseId.get(r.case_id);
      if (!targetCaseId || !r.student_email) continue;

      await supabaseEntities.StudentResult.create({
        student_email: r.student_email,
        student_name: r.student_name || r.student_email,
        case_id: targetCaseId,
        case_title: r.case_title || '',
        answers: Array.isArray(r.answers) ? r.answers : [],
        correct_count: r.correct_count || 0,
        total_questions: r.total_questions || 0,
        time_used_seconds: r.time_used_seconds || 0,
        percentage: r.percentage || 0,
        completed_at: r.completed_at || r.created_date || new Date().toISOString(),
        wildcard_used: Boolean(r.wildcard_used),
      });
      summary.resultados += 1;
    }
  } catch (err) {
    console.warn('Aviso leyendo student_results:', err.message);
  }

  return summary;
}

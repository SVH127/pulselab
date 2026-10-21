-- =============================================================================
-- PulseLab - Políticas de Seguridad Row Level Security (RLS) para Supabase
-- Equivalente relacional de firestore.rules
-- =============================================================================

BEGIN;

-- Funciones auxiliares basadas en el JWT de Supabase Auth
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT LOWER(COALESCE(
    current_setting('request.jwt.claims', true)::jsonb ->> 'email',
    ''
  ));
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_user_email() = 'vazquezhernandezsebastian1@gmail.com'
    OR EXISTS (
      SELECT 1
      FROM public.usuario u
      WHERE LOWER(u.correo) = public.current_user_email()
        AND u.rol = 'admin'
        AND u.activo = TRUE
    );
$$;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_user_email() = 'vazquezhernandezsebastian1@gmail.com'
    OR EXISTS (
      SELECT 1
      FROM public.usuario u
      WHERE LOWER(u.correo) = public.current_user_email()
        AND u.activo = TRUE
    );
$$;

-- Activar RLS en todas las tablas
ALTER TABLE public.usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caso_clinico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pregunta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resultado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.respuesta_alumno ENABLE ROW LEVEL SECURITY;

-- 1. Políticas para usuario
DROP POLICY IF EXISTS "usuario_select" ON public.usuario;
CREATE POLICY "usuario_select" ON public.usuario
  FOR SELECT
  USING (public.is_admin() OR LOWER(correo) = public.current_user_email());

DROP POLICY IF EXISTS "usuario_insert_admin" ON public.usuario;
CREATE POLICY "usuario_insert_admin" ON public.usuario
  FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR (
      LOWER(correo) = public.current_user_email()
      AND activo = TRUE
      AND (rol = 'admin' AND public.current_user_email() = 'vazquezhernandezsebastian1@gmail.com')
    )
  );

DROP POLICY IF EXISTS "usuario_update" ON public.usuario;
CREATE POLICY "usuario_update" ON public.usuario
  FOR UPDATE
  USING (public.is_admin() OR LOWER(correo) = public.current_user_email())
  WITH CHECK (
    public.is_admin()
    OR (
      LOWER(correo) = public.current_user_email()
      -- Impedir que un alumno cambie su propio rol o estado activo
      AND rol = (SELECT u.rol FROM public.usuario u WHERE u.id_usuario = usuario.id_usuario)
      AND activo = (SELECT u.activo FROM public.usuario u WHERE u.id_usuario = usuario.id_usuario)
    )
  );

DROP POLICY IF EXISTS "usuario_delete_admin" ON public.usuario;
CREATE POLICY "usuario_delete_admin" ON public.usuario
  FOR DELETE
  USING (public.is_admin());

-- 2. Políticas para caso_clinico
DROP POLICY IF EXISTS "caso_clinico_select" ON public.caso_clinico;
CREATE POLICY "caso_clinico_select" ON public.caso_clinico
  FOR SELECT
  USING (public.is_admin() OR (public.is_active_user() AND estado = 'published'));

DROP POLICY IF EXISTS "caso_clinico_admin_all" ON public.caso_clinico;
CREATE POLICY "caso_clinico_admin_all" ON public.caso_clinico
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3. Políticas para pregunta
DROP POLICY IF EXISTS "pregunta_select" ON public.pregunta;
CREATE POLICY "pregunta_select" ON public.pregunta
  FOR SELECT
  USING (
    public.is_admin()
    OR (
      public.is_active_user()
      AND EXISTS (
        SELECT 1 FROM public.caso_clinico c
        WHERE c.id_caso_clinico = pregunta.caso_clinico_id_caso_clinico
          AND c.estado = 'published'
      )
    )
  );

DROP POLICY IF EXISTS "pregunta_admin_all" ON public.pregunta;
CREATE POLICY "pregunta_admin_all" ON public.pregunta
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. Políticas para resultado
DROP POLICY IF EXISTS "resultado_select" ON public.resultado;
CREATE POLICY "resultado_select" ON public.resultado
  FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.usuario u
      WHERE u.id_usuario = resultado.usuario_id_usuario
        AND LOWER(u.correo) = public.current_user_email()
    )
  );

DROP POLICY IF EXISTS "resultado_insert" ON public.resultado;
CREATE POLICY "resultado_insert" ON public.resultado
  FOR INSERT
  WITH CHECK (
    public.is_active_user()
    AND EXISTS (
      SELECT 1 FROM public.usuario u
      WHERE u.id_usuario = resultado.usuario_id_usuario
        AND LOWER(u.correo) = public.current_user_email()
    )
  );

DROP POLICY IF EXISTS "resultado_admin_modify" ON public.resultado;
CREATE POLICY "resultado_admin_modify" ON public.resultado
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 5. Políticas para respuesta_alumno
DROP POLICY IF EXISTS "respuesta_alumno_select" ON public.respuesta_alumno;
CREATE POLICY "respuesta_alumno_select" ON public.respuesta_alumno
  FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.resultado r
      JOIN public.usuario u ON u.id_usuario = r.usuario_id_usuario
      WHERE r.id_resultado = respuesta_alumno.resultado_id_resultado
        AND LOWER(u.correo) = public.current_user_email()
    )
  );

DROP POLICY IF EXISTS "respuesta_alumno_insert" ON public.respuesta_alumno;
CREATE POLICY "respuesta_alumno_insert" ON public.respuesta_alumno
  FOR INSERT
  WITH CHECK (
    public.is_active_user()
    AND EXISTS (
      SELECT 1
      FROM public.resultado r
      JOIN public.usuario u ON u.id_usuario = r.usuario_id_usuario
      WHERE r.id_resultado = respuesta_alumno.resultado_id_resultado
        AND LOWER(u.correo) = public.current_user_email()
    )
  );

DROP POLICY IF EXISTS "respuesta_alumno_admin_modify" ON public.respuesta_alumno;
CREATE POLICY "respuesta_alumno_admin_modify" ON public.respuesta_alumno
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMIT;

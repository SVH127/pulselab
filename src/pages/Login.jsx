import { useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { dataClient } from '@/api/dataClient';
import { Button } from '@/components/ui/button';
import GoogleIcon from '@/components/GoogleIcon';
import BrandLogo from '@/components/BrandLogo';

export default function Login() {
  const buttonRef = useRef(null);
  const {
    isAuthenticated,
    isGoogleReady,
    googleClientId,
    authError,
    isFirebaseConfigured,
    isSupabaseConfigured,
    renderGoogleButton,
    signInWithGoogle,
    checkUserAuth,
  } = useAuth();

  useEffect(() => {
    if (isGoogleReady && buttonRef.current) {
      buttonRef.current.innerHTML = '';
      renderGoogleButton(buttonRef.current, { width: 320, text: 'continue_with' });
    }
  }, [isGoogleReady, renderGoogleButton]);

  const handleLocalDevLogin = async (role) => {
    const devUser =
      role === 'admin'
        ? {
            id: '1',
            email: 'vazquezhernandezsebastian1@gmail.com',
            full_name: 'Sebastián Vázquez (Admin)',
            name: 'Sebastián Vázquez (Admin)',
            role: 'admin',
            is_active: true,
          }
        : {
            id: '2',
            email: 'ana.martinez@alumno.pulselab.edu.mx',
            full_name: 'Ana Sofía Martínez',
            name: 'Ana Sofía Martínez',
            role: 'student',
            is_active: true,
          };

    await dataClient.entities.User.create(devUser);
    await dataClient.auth.setSession(devUser);
    await checkUserAuth();
  };

  if (isAuthenticated) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 text-foreground">
      <section className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl space-y-4">
        <div className="mb-2 text-center">
          <BrandLogo className="justify-center" imageClassName="h-16" />
          <p className="mt-2 text-sm text-muted-foreground">Inicia sesión en PulseLab</p>
        </div>

        {(isSupabaseConfigured || isFirebaseConfigured) ? (
          <Button onClick={signInWithGoogle} disabled={!isGoogleReady} className="w-full gap-2 bg-white text-slate-900 hover:bg-slate-100">
            <GoogleIcon className="h-4 w-4" />
            Continuar con Google
          </Button>
        ) : googleClientId ? (
          <div className="flex justify-center" ref={buttonRef} />
        ) : null}

        {import.meta.env.DEV && (
          <div className="space-y-2.5 pt-2 border-t border-border">
            <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-primary mb-1">Conectado a Supabase PostgreSQL (pulselab-dev)</p>
              Todo cambio que hagas aquí se guarda en vivo en las 5 tablas de tu proyecto en Supabase Cloud.
            </div>
            <Button
              onClick={() => handleLocalDevLogin('admin')}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Entrar como Docente / Admin
            </Button>
            <Button
              variant="outline"
              onClick={() => handleLocalDevLogin('student')}
              className="w-full border-primary/40 text-primary hover:bg-primary/10"
            >
              Entrar como Estudiante
            </Button>
          </div>
        )}

        {authError && (
          <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-red-300">
            {authError.type === 'user_not_registered'
              ? 'Tu usuario está inactivo o no tiene acceso.'
              : authError.message}
          </p>
        )}
      </section>
    </div>
  );
}

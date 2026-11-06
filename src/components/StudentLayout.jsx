import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import BrandLogo from '@/components/BrandLogo';
import { Volume2, VolumeX } from 'lucide-react';
import { useAudioExperience } from '@/components/AudioExperience';

export default function StudentLayout() {
  const { user, logout } = useAuth();
  const { enabled: audioEnabled, toggle: toggleAudio } = useAudioExperience();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/student/cases" aria-label="PulseLab" className="rounded-sm outline-none focus-visible:ring-0">
            <BrandLogo imageClassName="h-9" />
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{user?.email}</span>
            <button type="button" onClick={toggleAudio} aria-label={audioEnabled ? 'Silenciar sonidos' : 'Activar sonidos'} aria-pressed={audioEnabled}
              className="rounded-md border border-border p-2 hover:bg-accent" title={audioEnabled ? 'Silenciar sonidos' : 'Activar sonidos'}>
              {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <button onClick={logout} className="rounded-md border border-border px-3 py-1.5 hover:bg-accent">
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

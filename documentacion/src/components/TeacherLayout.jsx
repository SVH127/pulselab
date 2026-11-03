import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import BrandLogo from '@/components/BrandLogo';

export default function TeacherLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/teacher/cases" aria-label="PulseLab" className="rounded-sm outline-none focus-visible:ring-0">
            <BrandLogo imageClassName="h-9" />
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/teacher/cases" className="text-muted-foreground hover:text-foreground">Casos</Link>
            <Link to="/teacher/reports" className="text-muted-foreground hover:text-foreground">Reportes</Link>
            <Link to="/teacher/students" className="text-muted-foreground hover:text-foreground">Usuarios</Link>
            <span className="hidden text-muted-foreground sm:inline">{user?.email}</span>
            <button onClick={logout} className="rounded-md border border-border px-3 py-1.5 hover:bg-accent">
              Salir
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

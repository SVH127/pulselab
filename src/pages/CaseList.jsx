import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataClient } from '@/api/dataClient';
import { isFirebaseConfigured } from '@/api/firebaseClient';
import { isSupabaseConfigured } from '@/api/supabaseClient';
import { syncFirestoreToSupabase } from '@/api/firestoreToSupabaseSync';
import { PlusCircle, BookOpen, Edit2, Trash2, Eye, EyeOff, Database, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function CaseList() {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  const load = () => {
    setLoading(true);
    dataClient.entities.ClinicalCase.list('-created_date').then(setCases).finally(() => setLoading(false));
  };

  const handleSyncFromFirestore = async () => {
    try {
      setSyncing(true);
      const res = await syncFirestoreToSupabase();
      alert(`Sincronización completada hacia Supabase:\n• Casos nuevos importados: ${res.casos}\n• Usuarios sincronizados: ${res.usuarios}\n• Resultados importados: ${res.resultados}`);
      load();
    } catch (err) {
      alert(`No se pudo importar desde Firestore: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (c) => {
    if (!confirm(`¿Eliminar el caso "${c.title}"? Esta acción no se puede deshacer.`)) return;
    await dataClient.entities.ClinicalCase.delete(c.id);
    load();
  };

  const handleToggleStatus = async (c) => {
    await dataClient.entities.ClinicalCase.update(c.id, { status: c.status === 'published' ? 'draft' : 'published' });
    load();
  };

  const filtered = cases.filter(c => c.title?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Banco de Casos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Administra todos los casos clínicos (Base Relacional Supabase).</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isFirebaseConfigured && isSupabaseConfigured && (
            <Button
              variant="outline"
              onClick={handleSyncFromFirestore}
              disabled={syncing}
              className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              Importar desde Firestore
            </Button>
          )}
          <Button onClick={() => navigate('/teacher/cases/new')} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
            <PlusCircle className="w-4 h-4" />
            Nuevo Caso
          </Button>
        </div>
      </div>

      <Input
        placeholder="Buscar caso..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-sm bg-input"
      />

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-secondary/40 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-16 text-center">
          <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">{search ? 'No se encontraron casos.' : 'No hay casos aún.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 hover:border-primary/30 transition-all">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.title}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {c.questions?.length || 0} preguntas
                    {c.duration_minutes ? ` · ${c.duration_minutes} min` : ''}
                    {c.patient_name ? ` · ${c.patient_name}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                <span className={`hidden sm:block text-xs px-2 py-0.5 rounded-full font-mono border ${c.status === 'published' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-secondary text-muted-foreground border-border'}`}>
                  {c.status === 'published' ? 'Publicado' : 'Borrador'}
                </span>
                <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(c)} title={c.status === 'published' ? 'Despublicar' : 'Publicar'}>
                  {c.status === 'published'
                    ? <EyeOff className="w-4 h-4 text-muted-foreground" />
                    : <Eye className="w-4 h-4 text-primary" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => navigate(`/teacher/cases/${c.id}`)}>
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(c)}>
                  <Trash2 className="w-4 h-4 text-red-400" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

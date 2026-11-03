import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataClient } from '@/api/dataClient';
import { BookOpen, Clock, HelpCircle, Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function StudentCases() {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dataClient.entities.ClinicalCase.filter({ status: 'published' }, '-created_date')
      .then(setCases)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Casos Clínicos</h1>
        <p className="text-muted-foreground text-sm mt-1">Selecciona un caso para comenzar la simulación.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : cases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center">
          <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No hay casos publicados todavía.</p>
          <p className="text-xs text-muted-foreground mt-1">Tu docente publicará casos próximamente.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {cases.map(c => (
            <div key={c.id} className="bg-card border border-border rounded-2xl p-5 hover:border-primary/40 transition-all group">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <span className="text-xs text-primary font-mono border border-primary/20 bg-primary/5 px-2 py-0.5 rounded-full">Publicado</span>
              </div>
              <h3 className="font-semibold text-foreground mb-1 leading-tight">{c.title}</h3>
              {c.patient_name && <p className="text-xs text-muted-foreground mb-3">Paciente: {c.patient_name}{c.patient_age ? `, ${c.patient_age} años` : ''}</p>}
              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                <span className="flex items-center gap-1"><HelpCircle className="w-3 h-3" />{c.questions?.length || 0} preguntas</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{c.duration_minutes ? `${c.duration_minutes} min` : 'Sin límite'}</span>
              </div>
              <Button onClick={() => navigate(`/student/cases/${c.id}`)} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                <Play className="w-4 h-4" />
                Comenzar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

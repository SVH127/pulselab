import { useMemo, useState, useEffect } from 'react';
import { dataClient } from '@/api/dataClient';
import { BarChart3, Download, Eye, Search, Timer, Trophy, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function formatTime(secs) {
  if (!secs) return '-';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return 0;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

export default function Reports() {
  const [results, setResults] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchStudent, setSearchStudent] = useState('');
  const [filterCase, setFilterCase] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [selectedResult, setSelectedResult] = useState(null);

  useEffect(() => {
    Promise.all([
      dataClient.entities.StudentResult.list('-completed_at'),
      dataClient.entities.ClinicalCase.list(),
    ]).then(([r, c]) => {
      setResults(r);
      setCases(c);
      setLoading(false);
    });
  }, []);

  const filtered = results.filter((r) => {
    const query = searchStudent.toLowerCase();
    const nameOk = !query || r.student_name?.toLowerCase().includes(query) || r.student_email?.toLowerCase().includes(query);
    const caseOk = filterCase === 'all' || r.case_id === filterCase;
    const dateOk = !filterDate || r.completed_at?.startsWith(filterDate);
    return nameOk && caseOk && dateOk;
  });

  const stats = useMemo(() => {
    const studentCount = new Set(filtered.map((r) => r.student_email).filter(Boolean)).size;
    const avgScore = average(filtered.map((r) => Number(r.percentage)));
    const avgTime = average(filtered.map((r) => Number(r.time_used_seconds)));
    const completed = filtered.length;
    return { studentCount, avgScore, avgTime, completed };
  }, [filtered]);

  const chartData = useMemo(() => {
    const grouped = new Map();
    filtered.forEach((result) => {
      const key = result.case_id || result.case_title || 'sin-caso';
      const current = grouped.get(key) || {
        name: result.case_title || 'Sin caso',
        total: 0,
        scoreSum: 0,
      };
      current.total += 1;
      current.scoreSum += Number(result.percentage || 0);
      grouped.set(key, current);
    });

    return Array.from(grouped.values()).map((item) => ({
      name: item.name.length > 18 ? `${item.name.slice(0, 18)}...` : item.name,
      intentos: item.total,
      promedio: Math.round(item.scoreSum / item.total),
    }));
  }, [filtered]);

  const exportCSV = () => {
    const header = [
      'Estudiante',
      'Correo',
      'Caso',
      'Fecha',
      'Aciertos',
      'Total',
      'Tiempo',
      'Porcentaje',
      'Comodin usado',
      'Detalle por pregunta',
    ];
    const rows = filtered.map((r) => [
      r.student_name || '',
      r.student_email || '',
      r.case_title || '',
      formatDate(r.completed_at),
      r.correct_count ?? '',
      r.total_questions ?? '',
      formatTime(r.time_used_seconds),
      r.percentage !== undefined ? `${r.percentage}%` : '',
      r.wildcard_used ? 'Si' : 'No',
      (r.answers || []).map((a) => `P${Number(a.question_index) + 1}:${a.is_correct ? 'correcta' : a.timed_out ? 'tiempo' : 'incorrecta'}:${a.selected_option || '-'}`).join(' | '),
    ]);
    const csv = [header, ...rows].map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulselab_reportes_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearchStudent('');
    setFilterCase('all');
    setFilterDate('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reportes de Resultados</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{filtered.length} registro(s) encontrado(s).</p>
        </div>
        <Button onClick={exportCSV} variant="outline" className="gap-2 flex-shrink-0 border-primary/30 text-primary hover:bg-primary/10">
          <Download className="w-4 h-4" />
          Exportar CSV
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Trophy} label="Promedio" value={`${stats.avgScore}%`} tone={stats.avgScore >= 70 ? 'text-green-400' : stats.avgScore >= 50 ? 'text-yellow-400' : 'text-red-400'} />
        <StatCard icon={Users} label="Estudiantes" value={stats.studentCount} />
        <StatCard icon={BarChart3} label="Intentos" value={stats.completed} />
        <StatCard icon={Timer} label="Tiempo prom." value={formatTime(stats.avgTime)} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Promedio por caso</h2>
        <div className="h-56">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Bar dataKey="promedio" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sin datos para graficar.</div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar estudiante..." value={searchStudent} onChange={(e) => setSearchStudent(e.target.value)} className="pl-9 bg-input text-sm" />
        </div>
        <Select value={filterCase} onValueChange={setFilterCase}>
          <SelectTrigger className="w-52 bg-input text-sm">
            <SelectValue placeholder="Filtrar por caso" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los casos</SelectItem>
            {cases.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-44 bg-input text-sm" />
        {(searchStudent || filterCase !== 'all' || filterDate) && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground text-xs">
            Limpiar filtros
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estudiante</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Caso</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fecha</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aciertos</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tiempo</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">%</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array(7).fill(0).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-secondary/60 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">No hay registros que coincidan con los filtros.</td>
                </tr>
              ) : (
                filtered.map((r, i) => {
                  const pct = r.percentage ?? 0;
                  return (
                    <tr key={r.id || i} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium">{r.student_name || '-'}</p>
                        <p className="text-xs text-muted-foreground">{r.student_email}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[220px] truncate">{r.case_title || '-'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{formatDate(r.completed_at)}</td>
                      <td className="px-4 py-3 text-center font-mono font-semibold">{r.correct_count ?? '-'}/{r.total_questions ?? '-'}</td>
                      <td className="px-4 py-3 text-center font-mono text-sm text-muted-foreground">{formatTime(r.time_used_seconds)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-mono font-bold ${pct >= 70 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{pct}%</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedResult(r)}>
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ResultDetail result={selectedResult} onClose={() => setSelectedResult(null)} />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone = 'text-foreground' }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className={`mt-2 text-2xl font-bold font-mono ${tone}`}>{value}</p>
    </div>
  );
}

function ResultDetail({ result, onClose }) {
  if (!result) return null;

  return (
    <Dialog open={!!result} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle>Detalle del intento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail label="Estudiante" value={result.student_name || '-'} />
            <Detail label="Correo" value={result.student_email || '-'} />
            <Detail label="Caso" value={result.case_title || '-'} />
            <Detail label="Fecha" value={formatDate(result.completed_at)} />
            <Detail label="Resultado" value={`${result.correct_count ?? '-'} / ${result.total_questions ?? '-'} (${result.percentage ?? 0}%)`} />
            <Detail label="Tiempo" value={formatTime(result.time_used_seconds)} />
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/40 border-b border-border">
                  <th className="px-3 py-2 text-left text-xs uppercase text-muted-foreground">Pregunta</th>
                  <th className="px-3 py-2 text-left text-xs uppercase text-muted-foreground">Respuesta</th>
                  <th className="px-3 py-2 text-left text-xs uppercase text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody>
                {(result.answers || []).map((answer) => (
                  <tr key={answer.question_index} className="border-b border-border/50">
                    <td className="px-3 py-2 font-mono">P{Number(answer.question_index) + 1}</td>
                    <td className="px-3 py-2 font-mono uppercase">{answer.selected_option || '-'}</td>
                    <td className="px-3 py-2">
                      <span className={answer.is_correct ? 'text-green-400' : answer.timed_out ? 'text-yellow-400' : 'text-red-400'}>
                        {answer.is_correct ? 'Correcta' : answer.timed_out ? 'Sin tiempo' : 'Incorrecta'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

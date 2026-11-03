import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dataClient } from '@/api/dataClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, ArrowLeft, Plus, Trash2, Loader2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

const EMPTY_QUESTION = () => ({
  text: '', option_a: '', option_b: '', option_c: '', option_d: '',
  correct_option: 'a', feedback: '', concept: ''
});

export default function CaseEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [aiLoading, setAiLoading] = useState(null);
  const [expandedQ, setExpandedQ] = useState(0);

  const [form, setForm] = useState({
    title: '',
    status: 'draft',
    patient_name: '',
    patient_age: '',
    patient_weight: '',
    patient_height: '',
    patient_bmi: '',
    fc: '', fr: '', spo2: '', pa_systolic: '', pa_diastolic: '', temperature: '',
    duration_minutes: '',
    questions: [EMPTY_QUESTION()],
  });

  useEffect(() => {
    if (!isNew) {
      dataClient.entities.ClinicalCase.get(id).then(c => {
        setForm({
          title: c.title || '',
          status: c.status || 'draft',
          patient_name: c.patient_name || '',
          patient_age: c.patient_age || '',
          patient_weight: c.patient_weight || '',
          patient_height: c.patient_height || '',
          patient_bmi: c.patient_bmi || '',
          fc: c.fc || '', fr: c.fr || '', spo2: c.spo2 || '',
          pa_systolic: c.pa_systolic || '', pa_diastolic: c.pa_diastolic || '',
          temperature: c.temperature || '',
          duration_minutes: c.duration_minutes || '',
          questions: c.questions?.length ? c.questions : [EMPTY_QUESTION()],
        });
        setLoading(false);
      });
    }
  }, [id, isNew]);

  const calcBMI = (weight, height) => {
    const w = parseFloat(weight);
    const h = parseFloat(height) / 100;
    if (w > 0 && h > 0) return (w / (h * h)).toFixed(1);
    return '';
  };

  const setField = (key, val) => {
    setForm(f => {
      const updated = { ...f, [key]: val };
      if (key === 'patient_weight' || key === 'patient_height') {
        updated.patient_bmi = calcBMI(
          key === 'patient_weight' ? val : f.patient_weight,
          key === 'patient_height' ? val : f.patient_height
        );
      }
      return updated;
    });
  };

  const setQuestion = (index, key, val) => {
    setForm(f => {
      const qs = [...f.questions];
      qs[index] = { ...qs[index], [key]: val };
      return { ...f, questions: qs };
    });
  };

  const addQuestion = () => {
    if (form.questions.length >= 10) return;
    setForm(f => ({ ...f, questions: [...f.questions, EMPTY_QUESTION()] }));
    setExpandedQ(form.questions.length);
  };

  const removeQuestion = (i) => {
    if (form.questions.length <= 1) return;
    setForm(f => ({ ...f, questions: f.questions.filter((_, idx) => idx !== i) }));
    setExpandedQ(Math.max(0, expandedQ - 1));
  };

  const handleAI = async (index) => {
    const q = form.questions[index];
    if (!form.title || !q.text) return;
    setAiLoading(index);
    const correctText = q[`option_${q.correct_option}`] || `opción ${q.correct_option.toUpperCase()}`;
    setQuestion(index, 'feedback', `La respuesta correcta es ${q.correct_option.toUpperCase()}: ${correctText}. Revisa la valoración clínica, los signos vitales y la prioridad de atención para justificar esta decisión.`);
    setQuestion(index, 'concept', q.concept || 'Razonamiento clínico');
    setAiLoading(null);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        patient_age: form.patient_age ? Number(form.patient_age) : undefined,
        patient_weight: form.patient_weight ? Number(form.patient_weight) : undefined,
        patient_height: form.patient_height ? Number(form.patient_height) : undefined,
        patient_bmi: form.patient_bmi ? Number(form.patient_bmi) : undefined,
        fc: form.fc ? Number(form.fc) : undefined,
        fr: form.fr ? Number(form.fr) : undefined,
        spo2: form.spo2 ? Number(form.spo2) : undefined,
        pa_systolic: form.pa_systolic ? Number(form.pa_systolic) : undefined,
        pa_diastolic: form.pa_diastolic ? Number(form.pa_diastolic) : undefined,
        temperature: form.temperature ? Number(form.temperature) : undefined,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
      };
      if (isNew) {
        await dataClient.entities.ClinicalCase.create(payload);
      } else {
        await dataClient.entities.ClinicalCase.update(id, payload);
      }
      navigate('/teacher/cases');
    } catch (error) {
      console.error('No se pudo guardar el caso:', error);
      alert(`No se pudo guardar el caso: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const fieldClass = "bg-input border-border h-10 text-sm";
  const labelClass = "text-xs text-muted-foreground uppercase tracking-wide";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/teacher/cases')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{isNew ? 'Nuevo Caso Clínico' : 'Editar Caso'}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Todos los campos son opcionales salvo el título</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={form.status} onValueChange={v => setField('status', v)}>
            <SelectTrigger className={`w-36 ${fieldClass}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Borrador</SelectItem>
              <SelectItem value="published">Publicado</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleSave} disabled={saving || !form.title.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </Button>
        </div>
      </div>

      <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Información General</h2>
        <div className="space-y-1.5">
          <Label className={labelClass}>Título del Caso *</Label>
          <Input value={form.title} onChange={e => setField('title', e.target.value)} placeholder="Ej: Paciente con insuficiencia cardíaca aguda" className={fieldClass} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className={labelClass}>Nombre del Paciente</Label>
            <Input value={form.patient_name} onChange={e => setField('patient_name', e.target.value)} placeholder="María García" className={fieldClass} />
          </div>
          <div className="space-y-1.5">
            <Label className={labelClass}>Edad (años)</Label>
            <Input type="number" value={form.patient_age} onChange={e => setField('patient_age', e.target.value)} placeholder="65" className={fieldClass} />
          </div>
          <div className="space-y-1.5">
            <Label className={labelClass}>Peso (kg)</Label>
            <Input type="number" value={form.patient_weight} onChange={e => setField('patient_weight', e.target.value)} placeholder="70" className={fieldClass} />
          </div>
          <div className="space-y-1.5">
            <Label className={labelClass}>Talla (cm)</Label>
            <Input type="number" value={form.patient_height} onChange={e => setField('patient_height', e.target.value)} placeholder="160" className={fieldClass} />
          </div>
        </div>
        {form.patient_bmi && (
          <p className="text-xs text-primary font-mono">IMC calculado automáticamente: <strong>{form.patient_bmi}</strong></p>
        )}
      </section>

      <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Signos Vitales Base</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label className={labelClass}>FC (lpm)</Label><Input type="number" value={form.fc} onChange={e => setField('fc', e.target.value)} placeholder="80" className={fieldClass} /></div>
          <div className="space-y-1.5"><Label className={labelClass}>FR (rpm)</Label><Input type="number" value={form.fr} onChange={e => setField('fr', e.target.value)} placeholder="16" className={fieldClass} /></div>
          <div className="space-y-1.5"><Label className={labelClass}>SpO2 (%)</Label><Input type="number" value={form.spo2} onChange={e => setField('spo2', e.target.value)} placeholder="98" className={fieldClass} /></div>
          <div className="space-y-1.5"><Label className={labelClass}>PA Sistólica (mmHg)</Label><Input type="number" value={form.pa_systolic} onChange={e => setField('pa_systolic', e.target.value)} placeholder="120" className={fieldClass} /></div>
          <div className="space-y-1.5"><Label className={labelClass}>PA Diastólica (mmHg)</Label><Input type="number" value={form.pa_diastolic} onChange={e => setField('pa_diastolic', e.target.value)} placeholder="80" className={fieldClass} /></div>
          <div className="space-y-1.5"><Label className={labelClass}>Temperatura (°C)</Label><Input type="number" step="0.1" value={form.temperature} onChange={e => setField('temperature', e.target.value)} placeholder="36.5" className={fieldClass} /></div>
        </div>
      </section>

      <section className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Configuración</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className={labelClass}>Tiempo límite (minutos, 3-30)</Label>
            <Input type="number" min="3" max="30" value={form.duration_minutes} onChange={e => setField('duration_minutes', e.target.value)} placeholder="Sin límite" className={fieldClass} />
            <p className="text-[11px] text-muted-foreground">Deja en blanco para sin límite de tiempo.</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Preguntas ({form.questions.length}/10)</h2>
          <Button variant="outline" size="sm" onClick={addQuestion} disabled={form.questions.length >= 10} className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10">
            <Plus className="w-3 h-3" />Agregar
          </Button>
        </div>

        {form.questions.map((q, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl overflow-hidden">
            <button onClick={() => setExpandedQ(expandedQ === i ? -1 : i)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/30 transition-all">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-mono text-primary border border-primary/20 bg-primary/5 px-2 py-0.5 rounded">P{i+1}</span>
                <span className="text-sm text-muted-foreground truncate">{q.text || 'Sin texto aún...'}</span>
              </div>
              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                {form.questions.length > 1 && (
                  <span onClick={e => { e.stopPropagation(); removeQuestion(i); }} className="p-1 text-red-400 hover:bg-red-500/10 rounded">
                    <Trash2 className="w-3.5 h-3.5" />
                  </span>
                )}
                {expandedQ === i ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>

            {expandedQ === i && (
              <div className="px-5 pb-5 space-y-4 border-t border-border">
                <div className="space-y-1.5 pt-4">
                  <Label className={labelClass}>Texto de la pregunta</Label>
                  <Textarea value={q.text} onChange={e => setQuestion(i, 'text', e.target.value)} placeholder="¿Cuál es la intervención prioritaria de enfermería?" className="bg-input border-border resize-none text-sm" rows={2} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {['a','b','c','d'].map(opt => (
                    <div key={opt} className="space-y-1.5">
                      <Label className={labelClass}>Opción {opt.toUpperCase()}</Label>
                      <Input value={q[`option_${opt}`]} onChange={e => setQuestion(i, `option_${opt}`, e.target.value)} placeholder={`Opción ${opt.toUpperCase()}`} className={fieldClass} />
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <Label className={labelClass}>Opción correcta</Label>
                  <Select value={q.correct_option} onValueChange={v => setQuestion(i, 'correct_option', v)}>
                    <SelectTrigger className={`w-40 ${fieldClass}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['a','b','c','d'].map(o => <SelectItem key={o} value={o}>Opción {o.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className={labelClass}>Retroalimentación clínica</Label>
                    <Button variant="ghost" size="sm" onClick={() => handleAI(i)} disabled={aiLoading === i || !form.title || !q.text} className="text-xs gap-1.5 text-primary hover:bg-primary/10 h-7">
                      {aiLoading === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Sugerir texto
                    </Button>
                  </div>
                  <Textarea value={q.feedback} onChange={e => setQuestion(i, 'feedback', e.target.value)} placeholder="Justificación clínica de la respuesta correcta..." className="bg-input border-border resize-none text-sm" rows={3} />
                </div>

                <div className="space-y-1.5">
                  <Label className={labelClass}>Concepto teórico relacionado</Label>
                  <Input value={q.concept} onChange={e => setQuestion(i, 'concept', e.target.value)} placeholder="Ej: Valoración neurológica" className={fieldClass} />
                </div>
              </div>
            )}
          </div>
        ))}
      </section>

      <div className="flex justify-end pb-8">
        <Button onClick={handleSave} disabled={saving || !form.title.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 px-8">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isNew ? 'Crear Caso' : 'Guardar Cambios'}
        </Button>
      </div>
    </div>
  );
}

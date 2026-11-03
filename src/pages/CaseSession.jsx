import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dataClient } from '@/api/dataClient';
import VitalSignsMonitor from '@/components/VitalSignsMonitor';
import CaseTimer from '@/components/CaseTimer';
import { Button } from '@/components/ui/button';
import { Loader2, Shuffle, CheckCircle2, XCircle, ChevronRight, Trophy } from 'lucide-react';

export default function CaseSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [wildcardUsed, setWildcardUsed] = useState(false);
  const [eliminatedOptions, setEliminatedOptions] = useState([]);
  const [finished, setFinished] = useState(false);
  const [startTime] = useState(Date.now());
  const [user, setUser] = useState(null);
  const submitting = useRef(false);

  useEffect(() => {
    Promise.all([
      dataClient.entities.ClinicalCase.get(id),
      dataClient.auth.me(),
    ]).then(([c, u]) => {
      setCaseData(c);
      setUser(u);
      setLoading(false);
    });
  }, [id]);

  const questions = caseData?.questions || [];
  const question = questions[currentQ];

  const handleTimedOut = () => {
    const newAnswers = [...answers];
    for (let i = answers.length; i < questions.length; i++) {
      newAnswers.push({ question_index: i, selected_option: null, is_correct: false, timed_out: true });
    }
    finishCase(newAnswers);
  };

  const handleWildcard = () => {
    if (wildcardUsed || showFeedback) return;
    const incorrect = ['a','b','c','d'].filter(o => o !== question.correct_option);
    const toEliminate = incorrect.sort(() => Math.random() - 0.5).slice(0, 2);
    setEliminatedOptions(toEliminate);
    setWildcardUsed(true);
  };

  const handleSelect = (option) => {
    if (showFeedback || eliminatedOptions.includes(option)) return;
    setSelected(option);
  };

  const handleConfirm = () => {
    if (!selected) return;
    const isCorrect = selected === question.correct_option;
    const newAnswers = [...answers, { question_index: currentQ, selected_option: selected, is_correct: isCorrect, timed_out: false }];
    setAnswers(newAnswers);
    setShowFeedback(true);
  };

  const handleNext = () => {
    if (answers.length === questions.length) {
      finishCase(answers);
      return;
    }
    setShowFeedback(false);
    setSelected(null);
    setEliminatedOptions([]);
    setCurrentQ(q => q + 1);
  };

  const finishCase = async (finalAnswers) => {
    if (submitting.current) return;
    submitting.current = true;
    setFinished(true);
    const correct = finalAnswers.filter(a => a.is_correct).length;
    const total = questions.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const timeUsed = Math.round((Date.now() - startTime) / 1000);

    await dataClient.entities.StudentResult.create({
      student_email: user?.email || '',
      student_name: user?.full_name || '',
      case_id: id,
      case_title: caseData?.title || '',
      answers: finalAnswers,
      correct_count: correct,
      total_questions: total,
      time_used_seconds: timeUsed,
      percentage: pct,
      completed_at: new Date().toISOString(),
      wildcard_used: wildcardUsed,
    });
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  if (!caseData) return (
    <div className="text-center py-24 text-muted-foreground">Caso no encontrado.</div>
  );

  if (finished) {
    const correct = answers.filter(a => a.is_correct).length;
    const total = questions.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <VitalSignsMonitor caseData={caseData} />
        <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <Trophy className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Caso completado</h2>
            <p className="text-muted-foreground text-sm mt-1">{caseData.title}</p>
          </div>
          <div className="text-6xl font-bold font-mono text-primary">{pct}%</div>
          <p className="text-muted-foreground text-sm">{correct} de {total} respuestas correctas</p>

          <div className="space-y-2 text-left mt-4">
            {questions.map((q, i) => {
              const ans = answers[i];
              const selectedText = ans?.selected_option ? q[`option_${ans.selected_option}`] : null;
              return (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${ans?.is_correct ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                  {ans?.is_correct
                    ? <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    : <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  }
                  <div className="min-w-0">
                    <p className="font-medium text-foreground leading-snug">
                      Pregunta {i + 1}{q.text ? `: ${q.text}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {ans?.timed_out
                        ? 'Sin respuesta por tiempo agotado.'
                        : `Tu respuesta: ${ans?.selected_option?.toUpperCase() || '-'}${selectedText ? ` · ${selectedText}` : ''}`}
                    </p>
                    {!ans?.is_correct && q.feedback && (
                      <p className="text-xs text-muted-foreground mt-1 italic">{q.feedback}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Button onClick={() => navigate('/student/cases')} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 mt-4">
            Volver a Casos
          </Button>
        </div>
      </div>
    );
  }

  const OPTS = ['a','b','c','d'];
  const optLabels = { a: question?.option_a, b: question?.option_b, c: question?.option_c, d: question?.option_d };
  const lastAnswer = answers[answers.length - 1];

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <VitalSignsMonitor caseData={caseData} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">Pregunta {currentQ + 1} de {questions.length}</span>
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <div key={i} className={`h-1.5 w-6 rounded-full transition-all ${i < answers.length ? (answers[i]?.is_correct ? 'bg-green-400' : 'bg-red-400') : i === currentQ ? 'bg-primary' : 'bg-border'}`} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {caseData.duration_minutes && (
            <CaseTimer totalSeconds={caseData.duration_minutes * 60} onExpire={handleTimedOut} />
          )}
          <Button variant="outline" size="sm" disabled={wildcardUsed || showFeedback} onClick={handleWildcard} className={`text-xs gap-1.5 border ${wildcardUsed ? 'opacity-40 cursor-not-allowed' : 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10'}`}>
            <Shuffle className="w-3 h-3" />
            {wildcardUsed ? 'Comodín usado' : 'Comodín 50/50'}
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
        <p className="text-base font-medium leading-relaxed text-foreground">{question?.text}</p>

        <div className="space-y-2.5">
          {OPTS.map(opt => {
            const eliminated = eliminatedOptions.includes(opt);
            const isSelected = selected === opt;
            const isCorrect = opt === question?.correct_option;
            let style = 'border-border bg-secondary/30 text-foreground hover:border-primary/40 hover:bg-primary/5 cursor-pointer';
            if (eliminated) style = 'border-border/30 bg-secondary/10 text-muted-foreground/30 cursor-not-allowed line-through';
            else if (showFeedback) {
              if (isCorrect) style = 'border-green-500/50 bg-green-500/10 text-green-300';
              else if (isSelected) style = 'border-red-500/50 bg-red-500/10 text-red-300';
              else style = 'border-border/40 bg-secondary/20 text-muted-foreground';
            } else if (isSelected) {
              style = 'border-primary bg-primary/10 text-primary';
            }

            return (
              <button key={opt} onClick={() => handleSelect(opt)} disabled={showFeedback || eliminated}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all flex items-center gap-3 ${style}`}>
                <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold flex-shrink-0 ${isSelected && !showFeedback ? 'bg-primary border-primary text-primary-foreground' : 'border-current'}`}>
                  {opt.toUpperCase()}
                </span>
                {optLabels[opt]}
                {showFeedback && isCorrect && <CheckCircle2 className="w-4 h-4 text-green-400 ml-auto flex-shrink-0" />}
                {showFeedback && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-red-400 ml-auto flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        {showFeedback && (
          <div className={`rounded-xl border p-4 space-y-2 ${lastAnswer?.is_correct ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
            <div className="flex items-center gap-2">
              {lastAnswer?.is_correct
                ? <><CheckCircle2 className="w-4 h-4 text-green-400" /><span className="text-sm font-semibold text-green-400">¡Respuesta correcta!</span></>
                : <><XCircle className="w-4 h-4 text-red-400" /><span className="text-sm font-semibold text-red-400">Respuesta incorrecta</span></>
              }
            </div>
            {question?.feedback && <p className="text-sm text-muted-foreground leading-relaxed">{question.feedback}</p>}
            {question?.concept && (
              <p className="text-xs text-primary font-mono border border-primary/20 bg-primary/5 px-3 py-1.5 rounded-lg">
                Concepto: {question.concept}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          {!showFeedback ? (
            <Button onClick={handleConfirm} disabled={!selected} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
              Confirmar respuesta
            </Button>
          ) : (
            <Button onClick={handleNext} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
              {answers.length === questions.length ? 'Ver resultados' : 'Siguiente pregunta'}
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

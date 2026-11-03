import { Suspense, lazy, useEffect, useState } from 'react';
import { Activity, Box, HeartPulse, LayoutPanelTop, Thermometer, Wind } from 'lucide-react';

const MONITOR_MODE_KEY = 'pulselab_monitor_mode';
const VitalSignsMonitor3D = lazy(() => import('@/components/VitalSignsMonitor3D'));

const Vital = ({ icon: Icon, label, value, unit, color }) => (
  <div className="rounded-xl border border-border bg-card p-3">
    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
      <Icon className={`h-3.5 w-3.5 ${color}`} />
      {label}
    </div>
    <div className="font-mono text-lg font-semibold">
      {value || '--'} <span className="text-xs text-muted-foreground">{unit}</span>
    </div>
  </div>
);

function MonitorToggle({ mode, setMode }) {
  return (
    <div className="flex rounded-lg border border-border bg-background/60 p-1">
      <button
        type="button"
        onClick={() => setMode('2d')}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors ${mode === '2d' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
      >
        <LayoutPanelTop className="h-3.5 w-3.5" />
        2D
      </button>
      <button
        type="button"
        onClick={() => setMode('3d')}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors ${mode === '3d' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
      >
        <Box className="h-3.5 w-3.5" />
        3D
      </button>
    </div>
  );
}

function VitalSignsMonitor2D({ caseData, mode, setMode }) {
  return (
    <section className="rounded-2xl border border-border bg-secondary/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary animate-vital" />
          <h2 className="text-sm font-semibold">Monitor de signos vitales</h2>
        </div>
        <MonitorToggle mode={mode} setMode={setMode} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Vital icon={HeartPulse} label="FC" value={caseData?.fc} unit="lpm" color="text-vital-red" />
        <Vital icon={Wind} label="FR" value={caseData?.fr} unit="rpm" color="text-vital-blue" />
        <Vital icon={Activity} label="SpO2" value={caseData?.spo2} unit="%" color="text-vital-green" />
        <Vital icon={Thermometer} label="Temp" value={caseData?.temperature} unit="°C" color="text-vital-orange" />
      </div>
      {(caseData?.pa_systolic || caseData?.pa_diastolic) && (
        <div className="mt-3 text-xs text-muted-foreground">
          PA: <span className="font-mono text-foreground">{caseData?.pa_systolic || '--'}/{caseData?.pa_diastolic || '--'} mmHg</span>
        </div>
      )}
    </section>
  );
}

export default function VitalSignsMonitor({ caseData }) {
  const [mode, setModeState] = useState(() => localStorage.getItem(MONITOR_MODE_KEY) || '2d');

  const setMode = (nextMode) => {
    setModeState(nextMode);
    localStorage.setItem(MONITOR_MODE_KEY, nextMode);
  };

  useEffect(() => {
    if (!['2d', '3d'].includes(mode)) setMode('2d');
  }, [mode]);

  if (mode === '3d') {
    return (
      <div className="space-y-2">
        <div className="flex justify-end">
          <MonitorToggle mode={mode} setMode={setMode} />
        </div>
        <Suspense fallback={<div className="h-[340px] rounded-2xl border border-border bg-secondary/20 animate-pulse" />}>
          <VitalSignsMonitor3D caseData={caseData} />
        </Suspense>
      </div>
    );
  }

  return <VitalSignsMonitor2D caseData={caseData} mode={mode} setMode={setMode} />;
}

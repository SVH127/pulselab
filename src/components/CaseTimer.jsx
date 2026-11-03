import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

export default function CaseTimer({ totalSeconds, onExpire }) {
  const [remaining, setRemaining] = useState(totalSeconds);

  useEffect(() => {
    setRemaining(totalSeconds);
  }, [totalSeconds]);

  useEffect(() => {
    if (!remaining) {
      onExpire?.();
      return;
    }
    const timer = setTimeout(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [remaining, onExpire]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-mono text-muted-foreground">
      <Clock className="h-3.5 w-3.5" />
      {minutes}:{String(seconds).padStart(2, '0')}
    </div>
  );
}

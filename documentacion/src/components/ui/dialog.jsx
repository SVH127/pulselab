import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Dialog({ open, onOpenChange, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={() => onOpenChange?.(false)}>
      <div onMouseDown={(event) => event.stopPropagation()}>{children}</div>
    </div>
  );
}

export function DialogContent({ className, children }) {
  return (
    <div className={cn('relative w-[min(100vw-2rem,32rem)] rounded-lg border bg-card p-6 shadow-lg', className)}>
      {children}
    </div>
  );
}

export function DialogHeader({ className, children }) {
  return <div className={cn('mb-4 flex items-center justify-between', className)}>{children}</div>;
}

export function DialogTitle({ className, children }) {
  return <h2 className={cn('text-lg font-semibold', className)}>{children}</h2>;
}

export function DialogClose({ onClick }) {
  return (
    <button type="button" onClick={onClick} className="rounded-md p-1 hover:bg-accent">
      <X className="h-4 w-4" />
    </button>
  );
}

import React, { createContext, useContext, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const SelectContext = createContext(null);

export function Select({ value, onValueChange, children }) {
  const [open, setOpen] = useState(false);
  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ className, children }) {
  const { open, setOpen } = useContext(SelectContext);
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn('flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm', className)}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  );
}

export function SelectValue({ placeholder }) {
  const { value } = useContext(SelectContext);
  return <span>{value || placeholder}</span>;
}

export function SelectContent({ className, children }) {
  const { open } = useContext(SelectContext);
  if (!open) return null;
  return (
    <div className={cn('absolute z-50 mt-1 max-h-64 min-w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-md', className)}>
      {children}
    </div>
  );
}

export function SelectItem({ value, children }) {
  const context = useContext(SelectContext);
  return (
    <button
      type="button"
      className={cn('block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent', context.value === value && 'bg-accent')}
      onClick={() => {
        context.onValueChange?.(value);
        context.setOpen(false);
      }}
    >
      {children}
    </button>
  );
}

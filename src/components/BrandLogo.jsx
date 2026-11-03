import { cn } from '@/lib/utils';

export default function BrandLogo({ className, imageClassName }) {
  return (
    <span className={cn('inline-flex items-center', className)}>
      <img
        src="/pulselab-logo.png"
        alt="PulseLab"
        className={cn('h-10 w-auto object-contain', imageClassName)}
      />
    </span>
  );
}

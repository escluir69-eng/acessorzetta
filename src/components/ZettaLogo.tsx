import { cn } from '@/lib/utils';

export function ZettaLogo({ variant = 'horizontal', className, tone = 'dark' }: { variant?: 'horizontal' | 'vertical' | 'icon'; className?: string; tone?: 'light' | 'dark' }) {
  return <div aria-label="Zetta" className={cn('zetta-logo', variant === 'vertical' ? 'flex flex-col items-center gap-3' : 'flex items-center gap-3', tone === 'light' ? 'text-brand-ice' : 'text-brand-night', className)}>
    <svg viewBox="0 0 120 120" fill="none" aria-hidden="true" className={cn('shrink-0', variant === 'vertical' ? 'size-28' : variant === 'icon' ? 'size-full' : 'size-14')}>
      <circle cx="60" cy="60" r="47" fill="var(--brand-petrol)" fillOpacity=".22" stroke="var(--gold)" strokeWidth="1.5" />
      <ellipse cx="60" cy="60" rx="25" ry="47" stroke="var(--brand-petrol)" strokeWidth="1" />
      <ellipse cx="60" cy="60" rx="47" ry="20" stroke="var(--brand-petrol)" strokeWidth="1" />
      <path d="M32 81V65h10v16m4-9V53h10v19m4-10V41h10v21" fill="var(--brand-petrol)" />
      <path d="M53 90V78h8v12m5 0V65h8v25m5 0V50h9v40" fill="var(--gold)" />
      <path d="M33 44V29H91L36 94H91" stroke="var(--gold)" strokeWidth="4" strokeLinejoin="miter" />
      <ellipse cx="60" cy="60" rx="59" ry="23" transform="rotate(-30 60 60)" stroke="var(--gold)" strokeWidth="1.3" />
      <ellipse cx="60" cy="60" rx="59" ry="23" transform="rotate(38 60 60)" stroke="var(--gold)" strokeWidth="1.3" />
      <circle cx="14" cy="82" r="2.7" fill="var(--gold)" /><circle cx="108" cy="37" r="2.7" fill="var(--gold)" /><circle cx="99" cy="87" r="2.7" fill="var(--gold)" />
    </svg>
    {variant !== 'icon' && <div className="min-w-0"><span className={cn('font-display font-semibold leading-none', variant === 'vertical' ? 'text-4xl' : 'text-3xl')}>ZETTA</span><span className="mt-1 block text-[9px] opacity-75">Gestão pessoal, financeira e automação</span></div>}
  </div>;
}
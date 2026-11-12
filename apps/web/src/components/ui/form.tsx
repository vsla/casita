import { Check } from 'lucide-react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

const fieldBase =
  'w-full rounded-xl border border-line bg-white/70 px-4 text-base text-ink outline-none transition-colors placeholder:text-muted focus:border-sage focus:ring-2 focus:ring-sage/20 disabled:opacity-60';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, 'h-12', className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, 'min-h-28 resize-none py-3 leading-relaxed', className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        fieldBase,
        "h-12 appearance-none bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235e5a52' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] bg-[length:1.1rem] bg-[right_0.9rem_center] bg-no-repeat pr-10",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-sm font-semibold text-ink-soft">{label}</span>
      {children}
      {error ? <span className="text-sm text-danger">{error}</span> : hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  className,
  size = 'md',
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  className?: string;
  size?: 'md' | 'lg';
}) {
  return (
    // Área de toque de 44px mesmo com a caixa visual menor
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={cn('press -m-2.5 grid shrink-0 place-items-center p-2.5', className)}
    >
      <span
        className={cn(
          'grid place-items-center rounded-md border-[1.5px] transition-colors duration-200',
          size === 'lg' ? 'size-7' : 'size-[22px]',
          checked ? 'border-sage bg-sage text-white' : 'border-[#cfc6b7] bg-white/60',
        )}
      >
        <Check className={cn('transition-transform duration-200', size === 'lg' ? 'size-5' : 'size-4', checked ? 'scale-100' : 'scale-0')} strokeWidth={3} />
      </span>
    </button>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('relative h-8 w-14 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50', checked ? 'bg-sage' : 'bg-[#d8d0c2]')}
    >
      <span className={cn('absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform duration-200', checked && 'translate-x-6')} />
    </button>
  );
}

/** Controle segmentado (ex.: Dia / Semana / Mês) */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div role="tablist" className={cn('inline-flex rounded-2xl bg-paper-2 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'press h-10 rounded-xl px-4 text-sm font-semibold transition-colors',
            value === o.value ? 'bg-paper text-sage-deep shadow-sm' : 'text-ink-soft',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Chips de escolha única (responsável, categoria, tipo de atividade) */
export function ChoiceChips<T extends string | number | null>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; icon?: ReactNode }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            'press flex h-11 items-center gap-2 rounded-full border px-3.5 text-sm',
            value === o.value ? 'border-sage bg-sage-soft font-semibold text-sage-deep' : 'border-line bg-white/60 text-ink-soft',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

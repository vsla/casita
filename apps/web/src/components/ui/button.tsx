import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

// Alturas mínimas de 44px (h-11) para toque confortável
export const buttonVariants = cva(
  'press inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-sage/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-sage text-white shadow-sm hover:bg-sage-deep active:bg-sage-deep',
        secondary: 'bg-sage-wash text-sage-deep hover:bg-sage-soft',
        outline: 'border border-line bg-white/60 text-ink hover:bg-paper-2',
        ghost: 'text-ink-soft hover:bg-paper-2',
        danger: 'bg-danger-soft text-danger hover:bg-[#f0d2c7]',
      },
      size: {
        sm: 'h-9 px-3 text-sm [&_svg]:size-4',
        md: 'h-11 px-4',
        lg: 'h-12 px-5 text-base',
        icon: 'size-11',
        'icon-sm': 'size-9 [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { loading?: boolean };

export function Button({ className, variant, size, loading, children, disabled, type = 'button', ...props }: Props) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="animate-spin" />}
      {children}
    </button>
  );
}

/** Botão redondo "+" usado nos cabeçalhos dos cards */
export function AddButton({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn('press grid size-10 shrink-0 place-items-center rounded-full bg-sage text-white shadow-sm hover:bg-sage-deep', className)}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );
}

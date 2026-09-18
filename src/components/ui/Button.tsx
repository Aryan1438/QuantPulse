import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md';
}

const variantClasses: Record<string, string> = {
  primary: 'bg-accent text-bg font-semibold hover:opacity-90',
  secondary: 'bg-elevated text-text border border-border hover:bg-elevated-2',
  ghost: 'text-text-dim hover:text-text hover:bg-elevated',
  outline: 'border border-border text-text hover:bg-elevated',
};

const sizeClasses: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

export function Button({ children, variant = 'secondary', size = 'md', className = '', ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

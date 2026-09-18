import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  accent?: boolean;
}

export function Card({ children, className = '', accent = false, ...rest }: CardProps) {
  return (
    <div
      className={`rounded-xl border bg-surface p-5 ${
        accent ? 'border-accent/40' : 'border-border'
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mb-3 flex items-center justify-between ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h3 className={`text-sm font-semibold text-text ${className}`}>{children}</h3>;
}

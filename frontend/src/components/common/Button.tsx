import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const variantStyles = {
  primary: '',
  secondary: '',
  ghost: '',
};

const sizeStyles = {
  sm: 'px-3 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-base',
};

const variantStylesInline: Record<string, React.CSSProperties> = {
  primary: { background: 'var(--os-accent)', color: 'var(--os-text)' },
  secondary: { background: 'var(--os-surface-2)', color: 'var(--os-text-2)', border: '1px solid var(--os-border)' },
  ghost: { background: 'transparent', color: 'var(--os-text-2)', border: '1px solid var(--os-border)' },
};

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded font-medium transition-colors ${sizeStyles[size]} ${className}`}
      style={variantStylesInline[variant]}
      {...props}
    >
      {children}
    </button>
  );
}

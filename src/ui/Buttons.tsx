import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconWeight } from './Icon';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  block?: boolean;
  small?: boolean;
  /** Shows a spinner, disables the button. */
  loading?: boolean;
  /** Phosphor icon name shown before the label. */
  icon?: string;
  iconWeight?: IconWeight;
  children?: ReactNode;
}

export function Button({ variant = 'secondary', block, small, loading, icon, iconWeight = 'bold', className, disabled, children, type = 'button', ...rest }: ButtonProps) {
  const cls = ['btn', variant !== 'secondary' && `btn-${variant}`, block && 'btn-block', small && 'btn-sm', className].filter(Boolean).join(' ');
  return (
    <button {...rest} type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined}>
      {loading ? <span className="spinner" aria-hidden="true" /> : icon ? <Icon name={icon} weight={iconWeight} /> : null}
      {children}
    </button>
  );
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: string;
  /** Required: icon-only buttons need an accessible name. */
  label: string;
  weight?: IconWeight;
  plain?: boolean;
}

export function IconButton({ icon, label, weight = 'regular', plain, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button {...rest} type={type} aria-label={label} className={`iconbtn${plain ? ' plain' : ''}${className ? ' ' + className : ''}`}>
      <Icon name={icon} weight={weight} />
    </button>
  );
}

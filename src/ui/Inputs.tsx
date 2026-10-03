import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Icon } from './Icon';

/** Label above, helper or error below. Use directly for custom controls; Input/TextArea/Select already wrap it. */
export function Field({ label, htmlFor, descId, helper, error, children }: { label?: ReactNode; htmlFor?: string; descId?: string; helper?: ReactNode; error?: ReactNode; children: ReactNode }) {
  return (
    <div className={`field${error ? ' invalid' : ''}`}>
      {label ? <label htmlFor={htmlFor}>{label}</label> : null}
      {children}
      {error ? <div id={descId} className="error-text" role="alert">{error}</div> : helper ? <div id={descId} className="help">{helper}</div> : null}
    </div>
  );
}

interface FieldProps { label?: ReactNode; helper?: ReactNode; error?: ReactNode }

export function Input({ label, helper, error, id, className, ...rest }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} htmlFor={fid} descId={fid + '-d'} helper={helper} error={error}>
      <input {...rest} id={fid} className={`input${className ? ' ' + className : ''}`} aria-invalid={!!error || undefined} aria-describedby={error || helper ? fid + '-d' : undefined} />
    </Field>
  );
}

export function TextArea({ label, helper, error, id, className, ...rest }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} htmlFor={fid} descId={fid + '-d'} helper={helper} error={error}>
      <textarea {...rest} id={fid} className={`input${className ? ' ' + className : ''}`} aria-invalid={!!error || undefined} aria-describedby={error || helper ? fid + '-d' : undefined} />
    </Field>
  );
}

export function Select({ label, helper, error, id, className, children, ...rest }: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} htmlFor={fid} descId={fid + '-d'} helper={helper} error={error}>
      <select {...rest} id={fid} className={`input${className ? ' ' + className : ''}`} aria-invalid={!!error || undefined} aria-describedby={error || helper ? fid + '-d' : undefined}>{children}</select>
    </Field>
  );
}

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Accessible name; defaults to the placeholder. */
  label?: string;
  onSubmit?: () => void;
}

export function SearchField({ value, onChange, placeholder = 'Search', autoFocus, label, onSubmit }: SearchFieldProps) {
  return (
    <div className="search" role="search">
      <Icon name="magnifying-glass" />
      <input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSubmit?.(); }}
      />
      {value ? <button type="button" className="clear" aria-label="Clear search" onClick={() => onChange('')}><Icon name="x-circle" weight="fill" /></button> : null}
    </div>
  );
}

export interface SegmentedProps<T extends string> {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}

export function Segmented<T extends string>({ options, value, onChange, label }: SegmentedProps<T>) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name (also use when a visible label sits next to it). */
  label: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return <button type="button" role="switch" className="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} />;
}

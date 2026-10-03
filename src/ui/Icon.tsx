export type IconWeight = 'regular' | 'bold' | 'fill';

export interface IconProps {
  /** Phosphor icon name without the "ph-" prefix, e.g. "house", "magnifying-glass". */
  name: string;
  weight?: IconWeight;
  className?: string;
}

const PREFIX: Record<IconWeight, string> = { regular: 'ph', bold: 'ph-bold', fill: 'ph-fill' };

export function Icon({ name, weight = 'regular', className }: IconProps) {
  return <i className={`${PREFIX[weight]} ph-${name}${className ? ' ' + className : ''}`} aria-hidden="true" />;
}

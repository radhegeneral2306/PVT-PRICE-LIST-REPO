import type { ReactNode } from 'react';

export interface PageContainerProps {
  children: ReactNode;
  /** Wider content column on desktop (tables, two-column screens). */
  wide?: boolean;
  /** Narrow column on desktop (forms, settings). */
  narrow?: boolean;
  className?: string;
}

/** Centres screen content with a sensible max width. Phone: full width. Put it directly under TopBar. */
export function PageContainer({ children, wide, narrow, className }: PageContainerProps) {
  return <div className={`page-container${wide ? ' wide' : ''}${narrow ? ' narrow' : ''}${className ? ' ' + className : ''}`}>{children}</div>;
}

/** Sticky bottom bar for primary actions of a flow. Children are usually Buttons (they share the width). */
export function ActionBar({ children }: { children: ReactNode }) {
  return <div className="actionbar">{children}</div>;
}

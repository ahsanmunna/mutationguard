'use client';

import React from 'react';

export interface PanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  noPadding?: boolean;
}

/**
 * Standard content panel: bg-white dark:bg-slate-900 with 1px slate border and rounded-lg (8px).
 * Replaces nested heavy cards with a calm government-office aesthetic.
 */
export function Panel({
  title,
  description,
  headerAction,
  footer,
  noPadding = false,
  children,
  className = '',
  ...props
}: PanelProps) {
  const hasHeader = Boolean(title || headerAction);

  return (
    <div
      {...props}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg ${className}`}
    >
      {hasHeader && (
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <div>
            {title && (
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
            )}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}

      <div className={noPadding ? '' : 'p-4 sm:p-6'}>{children}</div>

      {footer && (
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 rounded-b-lg">
          {footer}
        </div>
      )}
    </div>
  );
}

export default Panel;

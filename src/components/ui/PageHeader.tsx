'use client';

import React from 'react';

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  kicker?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Standard PageHeader for land-record portal screens.
 * Clean, trustworthy typography without oversized headings or decorative gradients.
 */
export function PageHeader({
  title,
  description,
  kicker,
  action,
  className = '',
}: PageHeaderProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 ${className}`}
    >
      <div className="space-y-1">
        {kicker && <div className="text-xs font-medium text-slate-500 mb-0.5">{kicker}</div>}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0 pt-1 sm:pt-0">{action}</div>}
    </div>
  );
}

export default PageHeader;

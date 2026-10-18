'use client';

import React from 'react';
import { TriangleAlert } from 'lucide-react';

export interface FieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Accessible form field wrapper containing label, input control, optional hint, and error message.
 */
export function Field({
  label,
  htmlFor,
  required = false,
  hint,
  error,
  children,
  className = '',
}: FieldProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
      >
        {label}
        {required && <span className="text-rose-600 dark:text-rose-400 ml-1" aria-hidden="true">*</span>}
      </label>

      {children}

      {hint && !error && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      )}

      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1 font-medium">
          <TriangleAlert className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

export default Field;

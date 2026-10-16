'use client';

import React from 'react';
import { useLanguage } from './LanguageContext';
import { TransferStatus } from '@/lib/workflow/machine';

interface StatusBadgeProps {
  status: TransferStatus | string;
  size?: 'sm' | 'md' | 'lg';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const { t } = useLanguage();

  const getStatusConfig = (s: string) => {
    switch (s) {
      case 'submitted':
        return {
          bg: 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
          label: t('status_submitted'),
          icon: '📝',
        };
      case 'verified':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
          label: t('status_verified'),
          icon: '✅',
        };
      case 'under_review':
        return {
          bg: 'bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
          label: t('status_under_review'),
          icon: '🔍',
        };
      case 'approved':
        return {
          bg: 'bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-800',
          label: t('status_approved'),
          icon: '👍',
        };
      case 'finalized':
        return {
          bg: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 border-green-500 font-bold shadow-sm',
          label: t('status_finalized'),
          icon: '🏛️',
        };
      case 'held':
        return {
          bg: 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border-amber-400 font-bold shadow-sm',
          label: t('status_held'),
          icon: '⏸️',
        };
      case 'rejected':
        return {
          bg: 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-semibold',
          label: t('status_rejected'),
          icon: '❌',
        };
      default:
        return {
          bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300',
          label: s,
          icon: '•',
        };
    }
  };

  const config = getStatusConfig(status);
  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-xs'
      : size === 'lg'
      ? 'px-3.5 py-1.5 text-sm font-semibold'
      : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${config.bg} ${sizeClasses}`}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

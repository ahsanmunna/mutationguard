'use client';

import React from 'react';
import {
  Clock,
  CircleCheck,
  Search,
  BadgeCheck,
  FileCheck2,
  CirclePause,
  CircleX,
} from 'lucide-react';
import { useLanguage } from './LanguageContext';
import { TransferStatus } from '@/lib/workflow/machine';

interface StatusBadgeProps {
  status: TransferStatus | string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Compact rectangular status badge pairing an explicit Lucide icon with descriptive text.
 * Never communicates state via color alone.
 */
export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const { t } = useLanguage();

  const getStatusConfig = (s: string) => {
    switch (s) {
      case 'submitted':
        return {
          classes:
            'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
          label: t('status_submitted'),
          Icon: Clock,
        };
      case 'verified':
        return {
          classes:
            'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
          label: t('status_verified'),
          Icon: CircleCheck,
        };
      case 'under_review':
        return {
          classes:
            'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800',
          label: t('status_under_review'),
          Icon: Search,
        };
      case 'approved':
        return {
          classes:
            'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
          label: t('status_approved'),
          Icon: BadgeCheck,
        };
      case 'finalized':
        return {
          classes:
            'bg-emerald-600 text-white border-emerald-600 font-semibold shadow-xs',
          label: t('status_finalized'),
          Icon: FileCheck2,
        };
      case 'held':
        return {
          classes:
            'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-medium',
          label: t('status_held'),
          Icon: CirclePause,
        };
      case 'rejected':
        return {
          classes:
            'bg-transparent text-rose-700 dark:text-rose-400 border-rose-400 dark:border-rose-700 font-medium',
          label: t('status_rejected'),
          Icon: CircleX,
        };
      default:
        return {
          classes:
            'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
          label: s,
          Icon: Clock,
        };
    }
  };

  const config = getStatusConfig(status);
  const IconComponent = config.Icon;

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-xs'
      : size === 'lg'
      ? 'px-3 py-1.5 text-xs sm:text-sm font-semibold'
      : 'px-2.5 py-1 text-xs font-medium';

  const iconSize = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border ${config.classes} ${sizeClasses}`}
    >
      <IconComponent className={`${iconSize} shrink-0`} strokeWidth={1.75} aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}

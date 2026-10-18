'use client';

import React from 'react';
import { CircleCheck, TriangleAlert, OctagonX, Search } from 'lucide-react';
import { Finding } from '@/lib/rules/types';
import { useLanguage } from './LanguageContext';

interface ConflictAlertProps {
  findings: Finding[];
}

export default function ConflictAlert({ findings }: ConflictAlertProps) {
  const { t, language } = useLanguage();

  if (!findings || findings.length === 0) {
    return (
      <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center space-x-3">
        <CircleCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <div>
          <p className="font-semibold text-sm">{t('findings_title')}</p>
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            {t('no_findings')}
          </p>
        </div>
      </div>
    );
  }

  const getRuleBadge = (ruleId: string) => {
    switch (ruleId) {
      case 'DOUBLE_SALE':
        return {
          label: t('rules_double_sale'),
          bg: 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800',
          Icon: OctagonX,
        };
      case 'WRONG_SELLER':
        return {
          label: t('rules_wrong_seller'),
          bg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800',
          Icon: TriangleAlert,
        };
      case 'RECORD_MISMATCH':
        return {
          label: t('rules_record_mismatch'),
          bg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-800',
          Icon: Search,
        };
      default:
        return {
          label: ruleId,
          bg: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700',
          Icon: TriangleAlert,
        };
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-rose-800 dark:text-rose-400 flex items-center gap-1.5">
          <TriangleAlert className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span>
            {t('findings_title')} ({findings.length})
          </span>
        </h4>
        <span className="inline-flex items-center gap-1 text-xs uppercase font-semibold px-2.5 py-0.5 rounded bg-rose-600 text-white">
          <OctagonX className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span>{language === 'bn' ? 'পদক্ষেপ: স্থগিত' : 'ACTION: HOLD'}</span>
        </span>
      </div>

      {findings.map((finding, idx) => {
        const badge = getRuleBadge(finding.rule_id);
        const BadgeIcon = badge.Icon;
        return (
          <div
            key={idx}
            className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 border-l-rose-600 space-y-2.5 text-xs"
          >
            <div className="flex items-center justify-between">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium border ${badge.bg}`}
              >
                <BadgeIcon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span>{badge.label}</span>
              </span>
              <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                Rule ID: {finding.rule_id}
              </span>
            </div>

            <div className="font-medium text-slate-800 dark:text-slate-200 whitespace-pre-line bg-slate-50 dark:bg-slate-950 p-2.5 rounded border border-slate-200 dark:border-slate-800 font-mono text-xs">
              {typeof finding.evidence === 'object'
                ? (finding.evidence.message
                    ? `${finding.evidence.message}\n${JSON.stringify(finding.evidence, null, 2)}`
                    : JSON.stringify(finding.evidence, null, 2))
                : String(finding.evidence)}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
              <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                <span className="font-bold block text-slate-500 mb-0.5">
                  {language === 'bn' ? 'প্রত্যাশিত মান:' : 'EXPECTED:'}
                </span>
                <pre className="overflow-x-auto whitespace-pre-wrap">
                  {typeof finding.expected === 'object'
                    ? JSON.stringify(finding.expected, null, 2)
                    : String(finding.expected)}
                </pre>
              </div>
              <div className="p-2.5 rounded bg-rose-50/70 dark:bg-rose-950/40 text-rose-900 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
                <span className="font-bold block text-rose-600 dark:text-rose-400 mb-0.5">
                  {language === 'bn' ? 'প্রাপ্ত মান:' : 'OBSERVED:'}
                </span>
                <pre className="overflow-x-auto whitespace-pre-wrap">
                  {typeof finding.observed === 'object'
                    ? JSON.stringify(finding.observed, null, 2)
                    : String(finding.observed)}
                </pre>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

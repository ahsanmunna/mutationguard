'use client';

import React from 'react';
import { Finding } from '@/lib/rules/types';
import { useLanguage } from './LanguageContext';

interface ConflictAlertProps {
  findings: Finding[];
}

export default function ConflictAlert({ findings }: ConflictAlertProps) {
  const { t } = useLanguage();

  if (!findings || findings.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center space-x-3">
        <span className="text-xl">✅</span>
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
          bg: 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 border-rose-300',
        };
      case 'WRONG_SELLER':
        return {
          label: t('rules_wrong_seller'),
          bg: 'bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-200 border-orange-300',
        };
      case 'RECORD_MISMATCH':
        return {
          label: t('rules_record_mismatch'),
          bg: 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-300',
        };
      default:
        return { label: ruleId, bg: 'bg-slate-100 text-slate-800' };
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-rose-800 dark:text-rose-400 flex items-center gap-1.5">
          <span>⚠️</span>
          <span>
            {t('findings_title')} ({findings.length})
          </span>
        </h4>
        <span className="text-xs uppercase font-extrabold px-2 py-0.5 rounded bg-rose-600 text-white">
          ACTION: HOLD
        </span>
      </div>

      {findings.map((finding, idx) => {
        const badge = getRuleBadge(finding.rule_id);
        return (
          <div
            key={idx}
            className="p-4 rounded-lg bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 space-y-2 text-xs"
          >
            <div className="flex items-center justify-between">
              <span
                className={`px-2 py-0.5 rounded-full font-bold border ${badge.bg}`}
              >
                {badge.label}
              </span>
              <span className="text-slate-500 dark:text-slate-400 font-mono">
                Rule ID: {finding.rule_id}
              </span>
            </div>

            <div className="font-medium text-slate-800 dark:text-slate-200 whitespace-pre-line bg-white/70 dark:bg-slate-900/60 p-2.5 rounded border border-rose-100 dark:border-rose-900/40 font-mono text-xs">
              {typeof finding.evidence === 'object'
                ? (finding.evidence.message ? `${finding.evidence.message}\n${JSON.stringify(finding.evidence, null, 2)}` : JSON.stringify(finding.evidence, null, 2))
                : String(finding.evidence)}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
              <div className="p-2 rounded bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                <span className="font-bold block text-slate-500 mb-0.5">EXPECTED:</span>
                <pre className="overflow-x-auto whitespace-pre-wrap">
                  {typeof finding.expected === 'object'
                    ? JSON.stringify(finding.expected, null, 2)
                    : String(finding.expected)}
                </pre>
              </div>
              <div className="p-2 rounded bg-rose-100/60 dark:bg-rose-950/40 text-rose-900 dark:text-rose-300">
                <span className="font-bold block text-rose-600 dark:text-rose-400 mb-0.5">
                  OBSERVED:
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

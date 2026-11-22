'use client';

import React from 'react';
import { Check, TriangleAlert } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import {
  ComparisonRow,
  RegistryRecordInput,
  DeedRecordInput,
  ApplicationRecordInput,
  compareRecords,
  countDifferences,
} from '@/lib/wizard';
import { formatNumber, formatCount, localName, Language } from '@/lib/i18n/translations';

export interface RecordComparisonProps {
  rows?: ComparisonRow[];
  registry?: RegistryRecordInput;
  deed?: DeedRecordInput;
  application?: ApplicationRecordInput;
  language?: Language;
}

export function RecordComparison({
  rows,
  registry,
  deed,
  application,
  language: propLanguage,
}: RecordComparisonProps) {
  const context = useLanguage();
  const language = propLanguage || context?.language || 'bn';
  const bn = language === 'bn';

  const comparisonRows =
    rows ||
    (registry && deed && application
      ? compareRecords({ registry, deed, application })
      : []);

  const diffCount = countDifferences(comparisonRows);

  const formatDisplay = (field: string, val: string): string => {
    if (val === '—' || !val) return val || '—';
    if (field === 'seller') {
      return localName(val, language);
    }
    if (field === 'area') {
      const num = Number(val);
      if (!Number.isNaN(num)) {
        return `${formatNumber(num, language)} ${bn ? 'শতক' : 'dec'}`;
      }
    }
    return val;
  };

  return (
    <div className="space-y-4">
      {/* Desktop / Tablet Table View (>= 768px) */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/50 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <th scope="col" className="py-2.5 px-3">
                {bn ? 'বিবরণ' : 'Field'}
              </th>
              <th scope="col" className="py-2.5 px-3">
                {bn ? 'রেজিস্ট্রি রেকর্ড' : 'Registry'}
              </th>
              <th scope="col" className="py-2.5 px-3">
                {bn ? 'দলিল' : 'Deed'}
              </th>
              <th scope="col" className="py-2.5 px-3">
                {bn ? 'আবেদন' : 'Application'}
              </th>
              <th scope="col" className="py-2.5 px-3 text-right">
                {bn ? 'অবস্থা' : 'Status'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {comparisonRows.map((row) => (
              <tr
                key={row.field}
                className={row.differs ? 'bg-rose-50/40 dark:bg-rose-950/20' : undefined}
              >
                <th
                  scope="row"
                  className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap"
                >
                  {bn ? row.labelBn : row.labelEn}
                </th>
                <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                  <div>{formatDisplay(row.field, row.registry)}</div>
                  {row.registrySub && (
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {row.registrySub}
                    </div>
                  )}
                </td>
                <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                  <div>{formatDisplay(row.field, row.deed)}</div>
                  {row.deedSub && (
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {row.deedSub}
                    </div>
                  )}
                </td>
                <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                  {formatDisplay(row.field, row.application)}
                </td>
                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                  {row.differs ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 px-2 py-0.5 rounded-md">
                      <TriangleAlert className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                      <span>{bn ? 'অমিল' : 'Differs'}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-md">
                      <Check className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                      <span>{bn ? 'মিলেছে' : 'Matches'}</span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked Block View (< 768px) */}
      <div className="space-y-3 md:hidden">
        {comparisonRows.map((row) => (
          <div
            key={row.field}
            className={`p-3.5 rounded-lg border text-xs space-y-2.5 ${
              row.differs
                ? 'border-rose-300 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/20'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-2">
              <span className="font-semibold text-slate-900 dark:text-white text-sm">
                {bn ? row.labelBn : row.labelEn}
              </span>
              {row.differs ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 px-2 py-0.5 rounded-md">
                  <TriangleAlert className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                  <span>{bn ? 'অমিল' : 'Differs'}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-md">
                  <Check className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                  <span>{bn ? 'মিলেছে' : 'Matches'}</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-1.5 pt-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-slate-500 font-medium shrink-0">
                  {bn ? 'রেজিস্ট্রি:' : 'Registry:'}
                </span>
                <span className="text-slate-900 dark:text-white text-right font-medium">
                  <div>{formatDisplay(row.field, row.registry)}</div>
                  {row.registrySub && (
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {row.registrySub}
                    </div>
                  )}
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-2">
                <span className="text-slate-500 font-medium shrink-0">
                  {bn ? 'দলিল:' : 'Deed:'}
                </span>
                <span className="text-slate-900 dark:text-white text-right font-medium">
                  <div>{formatDisplay(row.field, row.deed)}</div>
                  {row.deedSub && (
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {row.deedSub}
                    </div>
                  )}
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-2">
                <span className="text-slate-500 font-medium shrink-0">
                  {bn ? 'আবেদন:' : 'Application:'}
                </span>
                <span className="text-slate-900 dark:text-white text-right font-medium">
                  {formatDisplay(row.field, row.application)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Line */}
      <div
        role="status"
        className={`p-3 rounded-md border text-xs sm:text-sm font-medium flex items-center gap-2.5 ${
          diffCount > 0
            ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
            : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
        }`}
      >
        {diffCount > 0 ? (
          <TriangleAlert
            className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        ) : (
          <Check
            className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        )}
        <span>
          {diffCount > 0
            ? (bn
                ? `${formatCount(diffCount, 'bn')}টি সম্ভাব্য অমিল পাওয়া গেছে। আবেদন দাখিল করার সময় নিয়মগুলো এগুলো যাচাই করবে এবং পর্যালোচনার জন্য আবেদনটি স্থগিত রাখার সম্ভাবনা রয়েছে।`
                : `${formatCount(diffCount, 'en')} potential difference(s) found. The rules check these when you submit and are likely to hold this application for review.`)
            : (bn
                ? 'তিনটি রেকর্ডের তথ্যে মিল রয়েছে। আবেদন দাখিল করার সময় অন্যান্য যাচাই, যেমন এই প্লটে বিদ্যমান সক্রিয় হস্তান্তর, পরিচালিত হবে।'
                : 'The three records agree. Other checks, such as an existing active transfer on this parcel, run when you submit.')}
        </span>
      </div>
    </div>
  );
}

export default RecordComparison;

'use client';

import React from 'react';
import { useLanguage } from './LanguageContext';

export default function Footer() {
  const { t, language } = useLanguage();

  return (
    <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <p className="font-semibold text-slate-700 dark:text-slate-300">
          {language === 'bn'
            ? 'মিউটেশনগার্ড — ভূমি নামজারি বিরোধ প্রতিরোধ ও অপরিবর্তনীয় অডিট লেজার'
            : 'MutationGuard — Land Mutation Conflict Prevention & Tamper-Evident Audit Ledger'}
        </p>
        {/* Required notice: all data is synthetic */}
        <p className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 font-medium">
          <span aria-hidden="true" className="font-bold">!</span>
          <span>{t('demo_footer_note')}</span>
        </p>
      </div>
    </footer>
  );
}
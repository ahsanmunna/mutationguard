'use client';

import React from 'react';
import { useLanguage } from './LanguageContext';

export default function Footer() {
  const { t, language } = useLanguage();

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 mt-auto py-6 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-3">
        {/* Visible Demo Data Warning */}
        <div className="inline-flex items-center px-4 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs sm:text-sm font-medium">
          <span className="mr-2">⚠️</span>
          <span>{t('demo_footer_note')}</span>
        </div>

        {/* AI Credits */}
        <div className="text-xs text-slate-500 dark:text-slate-400">
          <p className="font-medium">
            MutationGuard Land Title Conflict Prevention Engine
          </p>
          <p className="mt-1">
            Engineering & Collaboration Credits:{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Claude, ChatGPT, and Antigravity
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}

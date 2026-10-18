'use client';

import React from 'react';
import Image from 'next/image';
import { useLanguage } from './LanguageContext';

/** The MutationGuard mark, optionally with the product name beside it. */
export default function Logo({
  size = 36,
  showName = true,
  className = '',
}: {
  size?: number;
  showName?: boolean;
  className?: string;
}) {
  const { language } = useLanguage();

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image
        src="/brand/logo-mark.png"
        alt={showName ? '' : 'MutationGuard'}
        width={size}
        height={size}
        priority
      />
      {showName && (
        <span className="text-lg font-bold leading-none tracking-tight text-slate-900 dark:text-slate-50">
          {language === 'bn' ? 'মিউটেশনগার্ড' : 'MutationGuard'}
        </span>
      )}
    </span>
  );
}
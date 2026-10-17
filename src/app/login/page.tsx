'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/components/LanguageContext';
import { localName } from '@/lib/i18n/translations';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/dashboard';
  const { language } = useLanguage();
  const [loggingIn, setLoggingIn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const demoAccounts = [
    {
      username: 'officer_farhan',
      nameEn: 'Farhan Ahmed (AC Land)',
      nameBn: 'ফারহান আহমেদ (সহকারী কমিশনার ভূমি)',
      role: 'reviewer',
      roleBadge: 'Reviewer / কর্মকর্তা',
      descEn: 'Reviews applications, examines rule conflicts, approves or rejects transfers, and finalizes mutations.',
      descBn: 'আবেদন পর্যালোচনা, বিরোধ ও নিয়ম নিরীক্ষা, অনুমোদন/বাতিল এবং নামজারি চূড়ান্ত নিষ্পত্তি করেন।',
      icon: '🏛️',
      color: 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 hover:border-emerald-600',
    },
    {
      username: 'rahim_uddin',
      nameEn: 'Rahim Uddin',
      nameBn: 'রহিম উদ্দিন',
      role: 'applicant',
      roleBadge: 'Land Owner / বিক্রেতা',
      descEn: 'Registered owner of parcel P-001 (5.00 decimal in Dhanmondi-102).',
      descBn: 'ধানমন্ডি-১০২ মৌজার দাগ নং ১০০০১ এর ৫.০০ শতক জমির বৈধ নিবন্ধিত মালিক।',
      icon: '📜',
      color: 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 hover:border-blue-600',
    },
    {
      username: 'karim_chowdhury',
      nameEn: 'Karim Chowdhury',
      nameBn: 'করিম চৌধুরী',
      role: 'applicant',
      roleBadge: 'Buyer 1 / প্রথম ক্রেতা',
      descEn: 'Legitimate buyer for P-001 under valid Deed DEED-2026-001.',
      descBn: 'দলিল DEED-2026-001 এর মাধ্যমে ৫.০০ শতক জমির প্রথম বৈধ ক্রেতা।',
      icon: '🟢',
      color: 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20 hover:border-teal-600',
    },
    {
      username: 'hasan_mahmud',
      nameEn: 'Hasan Mahmud',
      nameBn: 'হাসান মাহমুদ',
      role: 'applicant',
      roleBadge: 'Buyer 2 / দ্বিতীয় ক্রেতা',
      descEn: 'Second buyer for P-001 under conflicting Deed DEED-2026-002 (triggers DOUBLE_SALE rule).',
      descBn: 'একই জমির দ্বিতীয় ক্রেতা (যা দাখিল করলে দ্বৈত হস্তান্তর সনাক্তকরণ নিয়ম সক্রিয় হয়)।',
      icon: '🔴',
      color: 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 hover:border-rose-600',
    },
  ];

  const handleLogin = async (username: string) => {
    setLoggingIn(username);
    setError(null);

    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to login');
      }

      // Refresh window / navigate to redirect path
      window.location.href = redirectPath;
    } catch (err: any) {
      setError(err.message);
      setLoggingIn(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4 sm:py-8">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          🔐 Stage A Academic Authentication Stub
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          {language === 'bn' ? 'ডেমো অ্যাকাউন্ট নির্বাচন ও লগইন' : 'Select a Demo Persona to Sign In'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
          {language === 'bn'
            ? 'হ্যাকাতন উপস্থাপনার জন্য পূর্ব-নির্ধারিত টেস্ট অ্যাকাউন্ট নির্বাচন করুন। বিচারকদের সামনে বিভিন্ন রোল প্রদর্শন করতে এক ক্লিকেই লগইন করুন।'
            : 'Click any role below to instantly authenticate as that actor and test workflow transitions and conflict detection.'}
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950 border border-rose-300 text-rose-800 dark:text-rose-200 text-sm font-semibold text-center">
          ❌ {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {demoAccounts.map((account) => (
          <div
            key={account.username}
            className={`p-6 rounded-2xl border-2 transition shadow-sm hover:shadow-md flex flex-col justify-between ${account.color}`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-3xl">{account.icon}</span>
                <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 shadow-xs border">
                  {account.roleBadge}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {language === 'bn' ? account.nameBn : account.nameEn}
                </h3>
                <p className="text-xs text-slate-500 font-mono">@{account.username}</p>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {language === 'bn' ? account.descBn : account.descEn}
              </p>
            </div>

            <button
              onClick={() => handleLogin(account.username)}
              disabled={loggingIn !== null}
              className="mt-6 w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loggingIn === account.username ? (
                <span>লগইন হচ্ছে...</span>
              ) : (
                <span>
                  {language === 'bn'
                    ? `${localName(account.nameEn, 'bn')} হিসেবে প্রবেশ করুন →`
                    : `Login as ${account.nameEn} →`}
                </span>
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900/50 text-center text-xs text-slate-500 space-y-1">
        <p className="font-semibold">
          {language === 'bn'
            ? 'স্টেজ বি নোট: এটি একটি পরীক্ষামূলক ডেমো লগইন স্টাব।'
            : 'Stage B Security Note: This is a clearly marked temporary demo stub.'}
        </p>
        <p>
          {language === 'bn'
            ? 'চূড়ান্ত উৎপাদনে ক্রিপ্টোগ্রাফিক সেশন কুকি ও পাসওয়ার্ড ভেরিফিকেশন যুক্ত হবে।'
            : 'Production deployment will replace this stub with bcrypt password authentication and signed HTTP-only sessions.'}
        </p>
      </div>
    </div>
  );
}

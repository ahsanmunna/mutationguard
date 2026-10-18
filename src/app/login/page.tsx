'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/components/LanguageContext';
import { localName } from '@/lib/i18n/translations';
import { useCurrentUser } from '@/lib/use-current-user';

/** Only allow redirects to pages on THIS site (blocks "?redirect=https://evil.example"). */
function safeRedirect(value: string | null): string {
  if (value && value.startsWith('/') && !value.startsWith('//')) return value;
  return '/dashboard';
}

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectPath = safeRedirect(searchParams.get('redirect'));
  const { language } = useLanguage();
  const bn = language === 'bn';
  const { user: sessionUser, demoMode } = useCurrentUser();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loggingIn, setLoggingIn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Already signed in? Go straight to the app.
  useEffect(() => {
    if (sessionUser) window.location.href = redirectPath;
  }, [sessionUser, redirectPath]);

  const demoAccounts = [
    {
      username: 'officer_farhan',
      nameEn: 'Farhan Ahmed (AC Land)',
      nameBn: 'ফারহান আহমেদ (সহকারী কমিশনার ভূমি)',
      role: 'reviewer',
      roleBadgeBn: 'কর্মকর্তা',
      roleBadgeEn: 'Reviewer',
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
      roleBadgeBn: 'জমির মালিক',
      roleBadgeEn: 'Land Owner',
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
      roleBadgeBn: 'প্রথম ক্রেতা',
      roleBadgeEn: 'Buyer 1',
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
      roleBadgeBn: 'দ্বিতীয় ক্রেতা',
      roleBadgeEn: 'Buyer 2',
      descEn: 'Second buyer for P-001 under conflicting Deed DEED-2026-002 (triggers DOUBLE_SALE rule).',
      descBn: 'একই জমির দ্বিতীয় ক্রেতা (যা দাখিল করলে দ্বৈত হস্তান্তর সনাক্তকরণ নিয়ম সক্রিয় হয়)।',
      icon: '🔴',
      color: 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 hover:border-rose-600',
    },
  ];

  const failureMessage = (status: number): string => {
    if (status === 401) return bn ? 'ব্যবহারকারীর নাম বা পাসওয়ার্ড সঠিক নয়।' : 'Incorrect username or password.';
    if (status === 429) return bn ? 'অনেকবার ভুল হয়েছে। কয়েক মিনিট পরে আবার চেষ্টা করুন।' : 'Too many failed attempts. Please wait a few minutes.';
    return bn ? 'প্রবেশ করা যায়নি। আবার চেষ্টা করুন।' : 'Could not sign in. Please try again.';
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        setError(failureMessage(res.status));
        setSubmitting(false);
        return;
      }
      window.location.href = redirectPath;
    } catch {
      setError(failureMessage(500));
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async (demoUsername: string) => {
    setLoggingIn(demoUsername);
    setError(null);
    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: demoUsername }),
      });
      if (!res.ok) {
        setError(failureMessage(res.status));
        setLoggingIn(null);
        return;
      }
      window.location.href = redirectPath;
    } catch {
      setError(failureMessage(500));
      setLoggingIn(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 py-4 sm:py-8 px-1">
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          {bn ? 'লগইন করুন' : 'Sign In'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          {bn ? 'আপনার ব্যবহারকারীর নাম ও পাসওয়ার্ড দিন।' : 'Enter your username and password.'}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="max-w-md mx-auto p-4 rounded-2xl bg-rose-50 dark:bg-rose-950 border border-rose-300 text-rose-800 dark:text-rose-200 text-sm font-semibold flex items-center gap-2"
        >
          <span aria-hidden="true">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <form
        onSubmit={handlePasswordLogin}
        className="max-w-md mx-auto p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
      >
        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {bn ? 'ব্যবহারকারীর নাম' : 'Username'}
          </span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            maxLength={100}
            className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm font-mono"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {bn ? 'পাসওয়ার্ড' : 'Password'}
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            maxLength={200}
            className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={submitting || loggingIn !== null}
          className="w-full min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <span className="animate-spin" aria-hidden="true">⏳</span>
              <span>{bn ? 'প্রবেশ করা হচ্ছে...' : 'Signing in...'}</span>
            </>
          ) : (
            <span>{bn ? 'প্রবেশ করুন' : 'Sign In'}</span>
          )}
        </button>
      </form>

      {demoMode && (
        <section className="space-y-4" aria-label={bn ? 'ডেমো অ্যাকাউন্ট' : 'Demo accounts'}>
          <div className="text-center space-y-1">
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
              {bn ? 'ডেমো অ্যাকাউন্ট (এক ক্লিকে প্রবেশ)' : 'Demo accounts (one-click sign in)'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {bn
                ? 'এগুলো কাল্পনিক ডেমো অ্যাকাউন্ট; সব তথ্য কাল্পনিক।'
                : 'These are fictional demo accounts; all data is synthetic.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {demoAccounts.map((account) => (
              <div
                key={account.username}
                className={`p-6 rounded-3xl border-2 transition shadow-sm hover:shadow-md flex flex-col justify-between ${account.color}`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl" aria-hidden="true">{account.icon}</span>
                    <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 shadow-sm">
                      {bn ? account.roleBadgeBn : account.roleBadgeEn}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {bn ? account.nameBn : account.nameEn}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">@{account.username}</p>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {bn ? account.descBn : account.descEn}
                  </p>
                </div>

                <button
                  onClick={() => handleDemoLogin(account.username)}
                  disabled={submitting || loggingIn !== null}
                  className="mt-6 min-h-[44px] w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 text-sm font-bold transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {loggingIn === account.username ? (
                    <>
                      <span className="animate-spin" aria-hidden="true">⏳</span>
                      <span>{bn ? 'প্রবেশ করা হচ্ছে...' : 'Signing in...'}</span>
                    </>
                  ) : (
                    <span>
                      {bn
                        ? `${localName(account.nameEn, 'bn')} হিসেবে প্রবেশ করুন`
                        : `Login as ${account.nameEn}`}
                    </span>
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900/50 text-center text-xs text-slate-500 border border-slate-200 dark:border-slate-800">
        {bn
          ? 'পাসওয়ার্ড bcrypt দিয়ে যাচাই করা হয় এবং সেশন কুকি স্বাক্ষরিত ও HttpOnly।'
          : 'Passwords are checked with bcrypt, and sessions use a signed, HttpOnly cookie.'}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { language } = useLanguage();
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-sm font-semibold text-slate-500 flex items-center justify-center gap-2">
          <span className="animate-spin" aria-hidden="true">⏳</span>
          <span>{language === 'bn' ? 'লগইন পাতা লোড হচ্ছে...' : 'Loading sign-in page...'}</span>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

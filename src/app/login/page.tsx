'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, TriangleAlert } from 'lucide-react';
import Logo from '@/components/Logo';
import { Button, Field } from '@/components/ui';
import { useLanguage } from '@/components/LanguageContext';
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

  // Demo accounts — all data is fictional/synthetic.
  const demoAccounts = [
    {
      username: 'officer_farhan',
      nameEn: 'Farhan Ahmed (AC Land)',
      nameBn: 'ফারহান আহমেদ (সহকারী কমিশনার ভূমি)',
      role: 'reviewer',
      roleBadgeBn: 'কর্মকর্তা',
      roleBadgeEn: 'Reviewer',
      descEn: 'Reviews applications, examines rule conflicts, approves or rejects transfers, and finalizes mutations.',
      descBn: 'আবেদন পর্যালোচনা, বিরোধ ও নিয়ম নিরীক্ষা, অনুমোদন/বাতিল এবং নামজারি চূড়ান্ত নিষ্পত্তি করেন।',
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
    },
    {
      username: 'hasan_mahmud',
      nameEn: 'Hasan Mahmud',
      nameBn: 'হাসান মাহমুদ',
      role: 'applicant',
      roleBadgeBn: 'দ্বিতীয় ক্রেতা',
      roleBadgeEn: 'Buyer 2',
      descEn: 'Second buyer for P-001 under conflicting Deed DEED-2026-002 (triggers DOUBLE_SALE rule).',
      descBn: 'একই জমির দ্বিতীয় ক্রেতা (যা দাখিল করলে দ্বৈত হস্তান্তর সনাক্তকরণ নিয়ম সক্রিয় হয়)।',
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

  const anyBusy = submitting || loggingIn !== null;

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-start justify-center px-4 pt-12 pb-16">
      <div className="w-full max-w-sm space-y-6">

        {/* Brand + page title */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <Logo size={40} showName={false} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {bn ? 'লগইন করুন' : 'Sign In'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {bn ? 'আপনার ব্যবহারকারীর নাম ও পাসওয়ার্ড দিন।' : 'Enter your username and password to continue.'}
            </p>
          </div>
        </div>

        {/* Error alert */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-sm"
          >
            <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Password login form */}
        <form
          onSubmit={handlePasswordLogin}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4"
        >
          <Field
            label={bn ? 'ব্যবহারকারীর নাম' : 'Username'}
            htmlFor="username"
            required
          >
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              maxLength={100}
              className="w-full min-h-[44px] px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </Field>

          <Field
            label={bn ? 'পাসওয়ার্ড' : 'Password'}
            htmlFor="password"
            required
          >
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              maxLength={200}
              className="w-full min-h-[44px] px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </Field>

          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={submitting}
            disabled={anyBusy}
            className="w-full"
          >
            {submitting
              ? (bn ? 'প্রবেশ করা হচ্ছে...' : 'Signing in...')
              : (bn ? 'প্রবেশ করুন' : 'Sign In')}
          </Button>
        </form>

        {/* Demo accounts — compact list rows, only in demo mode */}
        {demoMode && (
          <section aria-label={bn ? 'ডেমো অ্যাকাউন্ট' : 'Demo accounts'}>
            {/* Divider with heading */}
            <div className="relative my-1">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-slate-200 dark:border-slate-700" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white dark:bg-slate-950 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {bn ? 'ডেমো অ্যাকাউন্ট' : 'Demo accounts'}
                </span>
              </div>
            </div>

            {/* Compact rows */}
            <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
              {demoAccounts.map((account) => (
                <li
                  key={account.username}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  {/* Name + role + username */}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {bn ? account.nameBn : account.nameEn}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {bn ? account.roleBadgeBn : account.roleBadgeEn}
                      {' · '}
                      <span className="font-mono">@{account.username}</span>
                    </p>
                  </div>

                  {/* Enter button */}
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={loggingIn === account.username}
                    disabled={anyBusy}
                    onClick={() => handleDemoLogin(account.username)}
                    className="shrink-0 min-h-[44px]"
                  >
                    {loggingIn === account.username
                      ? (bn ? 'প্রবেশ...' : 'Entering...')
                      : (bn ? 'প্রবেশ' : 'Enter')}
                  </Button>
                </li>
              ))}
            </ul>

            <p className="mt-2 text-center text-xs text-slate-400 dark:text-slate-500">
              {bn ? 'এগুলো কাল্পনিক ডেমো অ্যাকাউন্ট; সব তথ্য কাল্পনিক।' : 'Fictional demo accounts; all data is synthetic.'}
            </p>
          </section>
        )}

        {/* Security note */}
        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          {bn
            ? 'পাসওয়ার্ড bcrypt দিয়ে যাচাই করা হয় এবং সেশন কুকি স্বাক্ষরিত ও HttpOnly।'
            : 'Passwords are checked with bcrypt, and sessions use a signed, HttpOnly cookie.'}
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { language } = useLanguage();
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
          <span>{language === 'bn' ? 'লগইন পাতা লোড হচ্ছে...' : 'Loading sign-in page...'}</span>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ClipboardList, FilePlus2, Link2, Lock, LogIn, ScrollText, Search, Zap } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { useCurrentUser } from '@/lib/use-current-user';

export default function HomePage() {
  const { t, language } = useLanguage();
  const bn = language === 'bn';
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const [recordId, setRecordId] = useState('');

  // "Check a record": opens the public verification page for an application ID (no API change).
  const openRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const id = recordId.trim();
    if (id) router.push(`/verify/${encodeURIComponent(id)}`);
  };

  const primaryButton =
    'min-h-[44px] px-5 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm inline-flex items-center gap-2 transition-colors';
  const secondaryButton =
    'min-h-[44px] px-5 py-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-semibold text-sm inline-flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors';

  const rules = [
    {
      id: 'DOUBLE_SALE',
      name: t('rules_double_sale'),
      text: bn
        ? 'একই খতিয়ান ও দাগে ইতোমধ্যে কোনো আবেদন চলমান থাকলে তাৎক্ষণিক সনাক্ত করে এবং দ্বিতীয় আবেদন হোল্ড করে।'
        : 'Instantly identifies when a parcel already has an active transfer in flight, placing concurrent submissions on hold.',
    },
    {
      id: 'WRONG_SELLER',
      name: t('rules_wrong_seller'),
      text: bn
        ? 'দলিলে উল্লিখিত বিক্রেতার নাম ও এনআইডি সরকারি রেকর্ড খতিয়ানের বর্তমান মালিকের সাথে না মিললে আবেদন আটকে দেয়।'
        : 'Verifies that the seller claimed on deed and application matches the officially recorded parcel owner.',
    },
    {
      id: 'RECORD_MISMATCH',
      name: t('rules_record_mismatch'),
      text: bn
        ? 'দলিল বনাম সরকারি রেকর্ড এবং আবেদন বনাম দলিলের মৌজা, খতিয়ান, দাগ, ও জমির পরিমাণের প্রতিটির অমিল স্পষ্টভাবে নির্দেশ করে।'
        : 'Cross-checks deed vs registry and application vs deed across mouza, khatian, dag, and area, reporting all differing fields.',
    },
  ];

  const steps = [
    bn ? 'আবেদন দাখিল' : 'Application submitted',
    bn ? 'নিয়মগুলো স্বয়ংক্রিয়ভাবে চলে' : 'Rules run automatically',
    bn ? 'কর্মকর্তা সিদ্ধান্ত নেন' : 'A reviewer decides',
    bn ? 'প্রতিটি ধাপ স্বাক্ষরিত অডিট ট্রেইলে লেখা হয়' : 'Every step is signed into the audit trail',
  ];

  const safeguards = [
    {
      icon: <Lock className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />,
      title: bn ? 'আংশিক ইউনিক ইনডেক্স' : 'PostgreSQL Partial Unique Index',
      text: bn
        ? 'one_active_transfer_per_parcel ইনডেক্স ডাটাবেস লেয়ারে প্রতিটি প্লটে মাত্র একটি সক্রিয় আবেদন নিশ্চিত করে কনকারেন্সি প্রতিরোধ করে।'
        : 'one_active_transfer_per_parcel enforces that only one active transfer exists per parcel at the physical database layer, stopping race conditions.',
    },
    {
      icon: <Link2 className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />,
      title: bn ? 'ক্রিপ্টোগ্রাফিক SHA-256 লেজার' : 'Tamper-Evident SHA-256 Ledger',
      text: bn
        ? 'প্রতিটি ওয়ার্কফ্লো রূপান্তর ট্রানজ্যাকশন-স্কোপড অ্যাডভাইজরি লক ও Ed25519 দিয়ে স্বাক্ষরিত। কোনো টেম্পারিং হলে চেইন ভেঙে যায়।'
        : 'Every workflow state change is cryptographically chained and signed with Ed25519 using transaction-scoped advisory locks. Any offline SQL tampering breaks the chain.',
    },
    {
      icon: <Zap className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />,
      title: bn ? 'অ্যাটোমিক চূড়ান্ত নিষ্পত্তি' : 'Atomic Finalization',
      text: bn
        ? 'অনুমোদিত আবেদনসমূহ পার্সেল মালিকানা, ইতিহাস, স্ট্যাটাস ও অডিট ইভেন্ট একক অল-অর-নাথিং এসকিউএল ট্রানজ্যাকশনে হালনাগাদ করে।'
        : 'Approved mutations update parcel ownership, append ownership history, update transfer status, and write audit events in a single all-or-nothing SQL transaction.',
    },
  ];

  return (
    <div className="space-y-12">
      {/* Intro: plain, left-aligned, no gradient or decoration */}
      <section className="max-w-3xl space-y-4 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          {bn ? 'ভূমি বিরোধ ও ভুয়া নামজারি প্রতিরোধ ব্যবস্থা' : 'Automated Land Dispute & Duplicate Mutation Prevention'}
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">{t('app_title')}</h1>
        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300">{t('app_subtitle')}</p>

        {!loading && (
          <div className="flex flex-wrap gap-3 pt-2">
            {!user && (
              <Link href="/login" className={primaryButton}>
                <LogIn className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                <span>{bn ? 'লগইন করুন' : 'Sign in'}</span>
              </Link>
            )}
            {user?.role === 'applicant' && (
              <>
                <Link href="/transfers/new" className={primaryButton}>
                  <FilePlus2 className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                  <span>{t('nav_submit')}</span>
                  <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                </Link>
                <Link href="/dashboard" className={secondaryButton}>
                  <ClipboardList className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                  <span>{t('nav_dashboard')}</span>
                </Link>
              </>
            )}
            {user?.role === 'reviewer' && (
              <>
                <Link href="/dashboard" className={primaryButton}>
                  <ClipboardList className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                  <span>{t('nav_dashboard')}</span>
                  <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                </Link>
                <Link href="/integrity" className={secondaryButton}>
                  <ScrollText className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                  <span>{bn ? 'অডিট নিরীক্ষা' : 'Audit integrity'}</span>
                </Link>
              </>
            )}
          </div>
        )}

        <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
          {bn
            ? 'এটি একটি সিদ্ধান্ত-সহায়ক প্রোটোটাইপ; চূড়ান্ত সিদ্ধান্ত নেন দায়িত্বপ্রাপ্ত কর্মকর্তা। সব তথ্য কাল্পনিক।'
            : 'A decision-support prototype: the final decision stays with the responsible officer. All data is fictional.'}
        </p>
      </section>

      {/* Check a record: opens the public verification page, no login needed */}
      <section className="max-w-3xl rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {bn ? 'রেকর্ড যাচাই করুন (লগইন ছাড়াই)' : 'Check a record (no login needed)'}
        </h2>
        <form onSubmit={openRecord} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={recordId}
            onChange={(e) => setRecordId(e.target.value)}
            placeholder="TR-2026-0001"
            aria-label={bn ? 'আবেদনের আইডি' : 'Application ID'}
            maxLength={40}
            className="flex-1 min-h-[44px] px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm font-mono"
          />
          <button type="submit" className={primaryButton}>
            <Search className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
            <span>{bn ? 'যাচাই করুন' : 'Check'}</span>
          </button>
        </form>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {bn ? 'আবেদনের আইডি লিখুন, যেমন TR-2026-0001' : 'Enter an application ID, for example TR-2026-0001'}
        </p>
      </section>

      {/* The three rules: plain rows, no cards */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {bn ? 'তিনটি নির্দিষ্ট সনাক্তকরণ নীতি' : 'Three Core Conflict Detection Rules'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {bn
              ? 'কোনো কৃত্রিম বুদ্ধিমত্তা বা অনুমান নয় — সরাসরি প্রমাণ ও লজিক্যাল ভ্যালিডেশন'
              : 'Deterministic, evidence-based verification without AI or speculative risk scoring'}
          </p>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800">
          {rules.map((rule) => (
            <div key={rule.id} className="py-4 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-6">
              <h3 className="sm:w-56 shrink-0 text-base font-semibold text-slate-900 dark:text-white">{rule.name}</h3>
              <p className="flex-1 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{rule.text}</p>
              <code className="shrink-0 self-start text-xs font-mono px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {rule.id}
              </code>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{bn ? 'কীভাবে কাজ করে' : 'How it works'}</h2>
        <ol className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {steps.map((step, index) => (
            <li key={index} className="flex sm:flex-col items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
              <span className="w-7 h-7 shrink-0 rounded border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center justify-center">
                {bn ? ['১', '২', '৩', '৪'][index] : index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Built-in safeguards */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {bn ? 'সিস্টেম আর্কিটেকচার ও নিরাপত্তা বৈশিষ্ট্য' : 'Built-in safeguards'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {safeguards.map((item) => (
            <div key={item.title} className="space-y-2 border-t-2 border-emerald-600 pt-3">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                {item.icon}
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
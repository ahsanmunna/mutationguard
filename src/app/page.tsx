'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageContext';

export default function HomePage() {
  const { t, language } = useLanguage();

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center py-10 px-4 rounded-3xl bg-gradient-to-b from-emerald-500/10 via-slate-500/5 to-transparent border border-emerald-500/20">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-semibold mb-4">
          <span>🛡️</span>
          <span>
            {language === 'bn'
              ? 'ভূমি বিরোধ ও ভুয়া নামজারি প্রতিরোধ ব্যবস্থা'
              : 'Automated Land Dispute & Duplicate Mutation Prevention'}
          </span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white max-w-4xl mx-auto leading-tight">
          {t('app_title')}
        </h1>
        <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
          {t('app_subtitle')}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/transfers/new"
            className="min-h-[44px] px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg hover:shadow-emerald-600/30 transition-all inline-flex items-center gap-1.5"
          >
            <span>➕</span>
            <span>{t('nav_submit')} →</span>
          </Link>
          <Link
            href="/dashboard"
            className="min-h-[44px] px-6 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all inline-flex items-center gap-1.5"
          >
            <span>📋</span>
            <span>{t('nav_dashboard')}</span>
          </Link>
          <Link
            href="/demo"
            className="min-h-[44px] px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md transition-all inline-flex items-center gap-1.5"
          >
            <span>🎮</span>
            <span>{t('nav_demo')}</span>
          </Link>
        </div>
      </section>

      {/* Exactly Three Detection Rules */}
      <section className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {language === 'bn' ? 'তিনটি নির্দিষ্ট সনাক্তকরণ নীতি' : 'Three Core Conflict Detection Rules'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {language === 'bn'
              ? 'কোনো কৃত্রিম বুদ্ধিমত্তা বা অনুমান নয় — সরাসরি প্রমাণ ও লজিক্যাল ভ্যালিডেশন'
              : 'Deterministic, evidence-based verification without AI or speculative risk scoring'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Rule 1 */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 flex items-center justify-center font-bold text-lg">
              1
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {t('rules_double_sale')}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {language === 'bn'
                ? 'একই খতিয়ান ও দাগে ইতোমধ্যে কোনো আবেদন চলমান থাকলে তাৎক্ষণিক সনাক্ত করে এবং দ্বিতীয় আবেদন হোল্ড করে।'
                : 'Instantly identifies when a parcel already has an active transfer in flight, placing concurrent submissions on hold.'}
            </p>
            <div className="pt-2 text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
              Rule ID: DOUBLE_SALE
            </div>
          </div>

          {/* Rule 2 */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-400 flex items-center justify-center font-bold text-lg">
              2
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {t('rules_wrong_seller')}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {language === 'bn'
                ? 'দলিলে উল্লিখিত বিক্রেতার নাম ও এনআইডি সরকারি রেকর্ড খতিয়ানের বর্তমান মালিকের সাথে না মিললে আবেদন আটকে দেয়।'
                : 'Verifies that the seller claimed on deed and application matches the officially recorded parcel owner.'}
            </p>
            <div className="pt-2 text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
              Rule ID: WRONG_SELLER
            </div>
          </div>

          {/* Rule 3 */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold text-lg">
              3
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {t('rules_record_mismatch')}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {language === 'bn'
                ? 'দলিল বনাম সরকারি রেকর্ড এবং আবেদন বনাম দলিলের মৌজা, খতিয়ান, দাগ, ও জমির পরিমাণের প্রতিটির অমিল স্পষ্টভাবে নির্দেশ করে।'
                : 'Cross-checks deed vs registry and application vs deed across mouza, khatian, dag, and area, reporting all differing fields.'}
            </p>
            <div className="pt-2 text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
              Rule ID: RECORD_MISMATCH
            </div>
          </div>
        </div>
      </section>

      {/* Architectural Pillars */}
      <section className="p-8 rounded-3xl bg-slate-900 text-white space-y-6">
        <h2 className="text-xl sm:text-2xl font-bold">
          {language === 'bn'
            ? 'সিস্টেম আর্কিটেকচার ও নিরাপত্তা বৈশিষ্ট্য'
            : 'Key Architectural & Safety Guarantees'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs sm:text-sm text-slate-300">
          <div className="space-y-2">
            <span className="text-xl">🔒</span>
            <h4 className="font-bold text-white">
              {language === 'bn' ? 'আংশিক ইউনিক ইনডেক্স' : 'PostgreSQL Partial Unique Index'}
            </h4>
            <p>
              {language === 'bn'
                ? 'one_active_transfer_per_parcel ইনডেক্স ডাটাবেস লেয়ারে প্রতিটি প্লটে মাত্র একটি সক্রিয় আবেদন নিশ্চিত করে কনকারেন্সি প্রতিরোধ করে।'
                : 'one_active_transfer_per_parcel enforces that only one active transfer exists per parcel at the physical database layer, stopping race conditions.'}
            </p>
          </div>
          <div className="space-y-2">
            <span className="text-xl">⛓️</span>
            <h4 className="font-bold text-white">
              {language === 'bn' ? 'ক্রিপ্টোগ্রাফিক SHA-256 লেজার' : 'Tamper-Evident SHA-256 Ledger'}
            </h4>
            <p>
              {language === 'bn'
                ? 'প্রতিটি ওয়ার্কফ্লো রূপান্তর ট্রানজ্যাকশন-স্কোপড অ্যাডভাইজরি লক ও Ed25519 দিয়ে স্বাক্ষরিত। কোনো টেম্পারিং হলে চেইন ভেঙে যায়।'
                : 'Every workflow state change is cryptographically chained and signed with Ed25519 using transaction-scoped advisory locks. Any offline SQL tampering breaks the chain.'}
            </p>
          </div>
          <div className="space-y-2">
            <span className="text-xl">⚡</span>
            <h4 className="font-bold text-white">
              {language === 'bn' ? 'অ্যাটোমিক চূড়ান্ত নিষ্পত্তি' : 'Atomic Finalization'}
            </h4>
            <p>
              {language === 'bn'
                ? 'অনুমোদিত আবেদনসমূহ পার্সেল মালিকানা, ইতিহাস, স্ট্যাটাস ও অডিট ইভেন্ট একক অল-অর-নাথিং এসকিউএল ট্রানজ্যাকশনে হালনাগাদ করে।'
                : 'Approved mutations update parcel ownership, append ownership history, update transfer status, and write audit events in a single all-or-nothing SQL transaction.'}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

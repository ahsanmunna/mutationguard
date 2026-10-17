'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageContext';
import { DEMO_COOKIE_NAME, SEEDED_USERS } from '@/lib/auth-types';

export default function IntegrityPage() {
  const { t, language } = useLanguage();

  const [verification, setVerification] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tampering, setTampering] = useState(false);
  const [tamperMessage, setTamperMessage] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>('officer_farhan');

  useEffect(() => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${DEMO_COOKIE_NAME}=([^;]*)`));
    if (match && match[1]) {
      setCurrentUsername(decodeURIComponent(match[1]));
    }
  }, []);

  const currentUser = SEEDED_USERS[currentUsername] || {
    username: currentUsername,
    role: 'applicant',
  };
  const isReviewer = currentUser.role === 'reviewer';

  const runVerification = async () => {
    try {
      setLoading(true);
      const [vRes, rRes] = await Promise.all([
        fetch('/api/audit/verify'),
        fetch('/api/audit/records'),
      ]);

      const vData = await vRes.json();
      const rData = await rRes.json();

      setVerification(vData);
      if (rData.records) setRecords(rData.records);
    } catch (err) {
      console.error('Verification error', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isReviewer) {
      runVerification();
    }
  }, [isReviewer]);

  const handleSimulateTamper = async (seq: number) => {
    try {
      setTampering(true);
      setTamperMessage(null);
      const res = await fetch('/api/audit/tamper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequence_num: seq }),
      });

      const data = await res.json();
      if (res.ok) {
        setTamperMessage(data.message);
        // Re-run verification to immediately show the red broken state
        await runVerification();
      } else {
        setTamperMessage(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setTamperMessage(`Error: ${err.message}`);
    } finally {
      setTampering(false);
    }
  };

  if (!isReviewer) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <span className="text-4xl">🔒</span>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {language === 'bn' ? 'অনুমতি নেই (Reviewer Access Only)' : 'Reviewer Role Required'}
        </h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          {language === 'bn'
            ? 'ক্রিপ্টোগ্রাফিক অডিট লেজার ও চেইন নিরীক্ষা শুধুমাত্র সহকারী কমিশনার (ভূমি) / রিভিউয়ারদের জন্য উন্মুক্ত। অনুগ্রহ করে হেডার থেকে অফিসার ফারহান অ্যাকাউন্টে স্যুইচ করুন।'
            : 'The cryptographic audit ledger inspection console is restricted to reviewing officers. Please switch to Officer Farhan in the header or login screen.'}
        </p>
        <Link
          href="/login"
          className="inline-block px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
        >
          {language === 'bn' ? 'অফিসার হিসেবে লগইন করুন →' : 'Sign in as Officer →'}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          {language === 'bn'
            ? 'ক্রিপ্টোগ্রাফিক চেইন ও অডিট লেজার নিরীক্ষা'
            : 'Cryptographic Audit Ledger & Chain Integrity'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {language === 'bn'
            ? 'SHA-256 হ্যাশ চেইনিং ও Ed25519 ডিজিটাল স্বাক্ষরের মাধ্যমে প্রতিটি পরিবর্তন নিরীক্ষা করুন।'
            : 'Walks the global audit chain from genesis to head, verifying SHA-256 continuity and Ed25519 digital signatures.'}
        </p>
      </div>

      {/* Verification Status Banner */}
      {verification && (
        <div
          className={`p-6 rounded-2xl border ${
            verification.valid
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/80 border-rose-400 dark:border-rose-800 text-rose-900 dark:text-rose-100'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{verification.valid ? '✅' : '🚨'}</span>
              <div>
                <h3 className="text-lg font-bold">
                  {verification.valid ? t('chain_valid') : t('chain_invalid')}
                </h3>
                <p className="text-xs opacity-80 mt-0.5">
                  {verification.valid
                    ? `Total Blocks: ${verification.total_records} • Head Hash: ${verification.latest_hash?.slice(0, 16)}...`
                    : `Broken at block sequence #${verification.sequence_num} on field "${verification.field}"`}
                </p>
              </div>
            </div>

            <button
              onClick={runVerification}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? 'Auditing...' : t('verify_chain_button')}
            </button>
          </div>

          {!verification.valid && (
            <div className="mt-4 pt-4 border-t border-rose-200 dark:border-rose-900/50 text-xs space-y-2">
              <div className="font-semibold text-rose-800 dark:text-rose-300">
                {verification.details}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 font-mono text-[11px]">
                <div className="p-2.5 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                  <span className="font-bold text-slate-500 block">EXPECTED VALUE:</span>
                  <div className="break-all">{verification.expected_value}</div>
                </div>
                <div className="p-2.5 rounded bg-rose-100 dark:bg-rose-900/60 text-rose-950 dark:text-rose-100">
                  <span className="font-bold text-rose-700 dark:text-rose-400 block">CALCULATED / OBSERVED:</span>
                  <div className="break-all">{verification.calculated_value}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tamperMessage && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-300 text-amber-900 dark:text-amber-200 text-xs font-medium">
          🧪 Simulation Result: {tamperMessage}
        </div>
      )}

      {/* Audit Blocks Sequence Explorer */}
      <div className="space-y-4">
        <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center justify-between">
          <span>Global Audit Sequence ({records.length} Blocks)</span>
          <span className="text-xs text-slate-500 font-normal">
            Enforced by PostgreSQL Transaction Advisory Lock
          </span>
        </h3>

        {records.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            No audit records created yet. Submit a transfer to initialize block sequence #1.
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((block) => (
              <div
                key={block.sequence_num}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-xs space-y-2 transition"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-slate-900 dark:bg-slate-800 text-white font-mono font-bold flex items-center justify-center text-[11px]">
                      #{block.sequence_num}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white uppercase">
                      {block.event_type}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500 font-mono">Entity: {block.entity_id}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-500">
                      by <span className="font-semibold">{block.actor_username}</span> ({block.actor_role})
                    </span>
                    <button
                      onClick={() => handleSimulateTamper(block.sequence_num)}
                      disabled={tampering}
                      className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[10px] font-bold hover:bg-rose-100 transition"
                      title="Simulate offline database tampering on this block"
                    >
                      🧪 Inject Tamper
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 font-mono text-[10px] text-slate-600 dark:text-slate-400">
                  <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded">
                    <span className="text-slate-400 block">PREVIOUS HASH:</span>
                    <span className="break-all">{block.previous_hash}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded">
                    <span className="text-slate-400 block">RECORD HASH:</span>
                    <span className="break-all text-emerald-700 dark:text-emerald-400 font-bold">
                      {block.record_hash}
                    </span>
                  </div>
                </div>

                <div className="pt-1">
                  <span className="text-slate-400 block text-[10px] mb-0.5">PAYLOAD:</span>
                  <pre className="p-2 rounded bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-300 font-mono text-[10px] overflow-x-auto whitespace-pre-wrap">
                    {typeof block.payload === 'string'
                      ? block.payload
                      : JSON.stringify(block.payload, null, 2)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

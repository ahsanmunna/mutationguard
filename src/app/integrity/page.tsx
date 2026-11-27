'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Check,
  TriangleAlert,
  Search,
  Lock,
  ChevronDown,
  FlaskConical,
  User,
  ShieldCheck,
  ShieldAlert,
  Download,
  Upload,
  X,
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { useCurrentUser } from '@/lib/use-current-user';
import { localName, formatCount } from '@/lib/i18n/translations';
import { Button, PageHeader, Panel } from '@/components/ui';
import type {
  AuditCheckpoint,
  CheckpointVerificationResult,
} from '@/lib/audit/checkpoint';

export default function IntegrityPage() {
  const { t, language } = useLanguage();
  const bn = language === 'bn';

  const [verification, setVerification] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tampering, setTampering] = useState(false);
  const [tamperMessage, setTamperMessage] = useState<string | null>(null);
  const [selectedTamperSeq, setSelectedTamperSeq] = useState<number>(1);
  const [exportingCheckpoint, setExportingCheckpoint] = useState(false);
  const [exportedCheckpoint, setExportedCheckpoint] = useState<AuditCheckpoint | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [checkpointInput, setCheckpointInput] = useState('');
  const [verifyingCheckpoint, setVerifyingCheckpoint] = useState(false);
  const [checkpointResult, setCheckpointResult] = useState<CheckpointVerificationResult | null>(null);
  const [verifyCheckpointError, setVerifyCheckpointError] = useState<string | null>(null);

  // Who is logged in comes from the server (signed httpOnly session)
  const { user: sessionUser } = useCurrentUser();
  const currentUser = sessionUser ?? { username: '', fullName: '', role: 'applicant' as const };
  const isReviewer = currentUser.role === 'reviewer';

  // One-line explanation of the FIRST failure
  const failureSummary =
    verification && !verification.valid
      ? verification.kind === 'deed'
        ? bn
          ? `দলিল ${verification.record_id} এর "${verification.field}" ফিল্ডে পরিবর্তন ধরা পড়েছে`
          : `Deed ${verification.record_id} was altered: field "${verification.field}" no longer matches its anchor`
        : verification.kind === 'ownership'
        ? bn
          ? `পার্সেল ${verification.record_id} এর মালিকানা ইতিহাসে "${verification.field}" ফিল্ডে পরিবর্তন ধরা পড়েছে`
          : `Parcel ${verification.record_id} ownership history was altered: field "${verification.field}" no longer matches its record`
        : bn
        ? `ব্লক #${formatCount(verification.sequence_num, language)} এর "${verification.field}" ফিল্ডে চেইন বিচ্ছিন্ন`
        : `Broken at block sequence #${verification.sequence_num} on field "${verification.field}"`
      : '';

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
      if (rData.records) {
        setRecords(rData.records);
        if (rData.records.length > 0) {
          setSelectedTamperSeq(rData.records[0].sequence_num);
        }
      }
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

  const runTamper = async (payload: Record<string, unknown>) => {
    try {
      setTampering(true);
      setTamperMessage(null);
      const res = await fetch('/api/audit/tamper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setTamperMessage(data.message);
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

  const handleSimulateTamper = (seq: number) => runTamper({ sequence_num: seq });

  const handleDeedTamper = () => runTamper({ target: 'deed', deed_number: 'DEED-2026-001' });

  const handleOwnerTamper = () => runTamper({ target: 'owner', parcel_id: 'P-001' });

  const handleExportCheckpoint = async () => {
    try {
      setExportingCheckpoint(true);
      setExportError(null);
      const res = await fetch('/api/audit/checkpoint');
      const data = await res.json();
      if (!res.ok) {
        setExportedCheckpoint(null);
        setExportError(
          data?.error ||
            (bn
              ? 'চেকপয়েন্ট এক্সপোর্ট করা যায়নি।'
              : 'Could not export checkpoint.')
        );
        return;
      }

      const checkpoint = data as AuditCheckpoint;
      setExportedCheckpoint(checkpoint);

      const blob = new Blob([JSON.stringify(checkpoint, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `mutationguard-checkpoint-${checkpoint.head_sequence}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setExportError(err?.message || 'Failed to export checkpoint.');
    } finally {
      setExportingCheckpoint(false);
    }
  };

  const handleCheckpointFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      setCheckpointInput(text);
      setVerifyCheckpointError(null);
      setCheckpointResult(null);
    } catch {
      setVerifyCheckpointError(
        bn
          ? 'নির্বাচিত ফাইলটি পড়া যায়নি।'
          : 'Could not read the selected file.'
      );
    }
  };

  const handleVerifyCheckpoint = async () => {
    setVerifyCheckpointError(null);
    setCheckpointResult(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(checkpointInput);
    } catch {
      setVerifyCheckpointError(
        bn
          ? 'অবৈধ JSON। অনুগ্রহ করে একটি সঠিক চেকপয়েন্ট JSON পেস্ট বা আপলোড করুন।'
          : 'Invalid JSON. Please paste or upload a valid checkpoint JSON.'
      );
      return;
    }

    try {
      setVerifyingCheckpoint(true);
      const res = await fetch('/api/audit/verify-checkpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!res.ok) {
        setVerifyCheckpointError(
          data?.error ||
            (bn
              ? 'চেকপয়েন্ট যাচাই করা যায়নি।'
              : 'Could not verify checkpoint.')
        );
        return;
      }
      setCheckpointResult(data as CheckpointVerificationResult);
    } catch (err: any) {
      setVerifyCheckpointError(err?.message || 'Failed to verify checkpoint.');
    } finally {
      setVerifyingCheckpoint(false);
    }
  };

  if (!isReviewer) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4 px-4">
        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 mx-auto flex items-center justify-center">
          <Lock className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {bn ? 'অনুমতি প্রয়োজন — শুধুমাত্র রিভিউয়ারদের জন্য' : 'Reviewer Role Required'}
        </h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
          {bn
            ? 'ক্রিপ্টোগ্রাফিক অডিট লেজার ও চেইন নিরীক্ষা শুধুমাত্র সহকারী কমিশনার (ভূমি) / রিভিউয়ারদের জন্য উন্মুক্ত।'
            : 'The cryptographic audit ledger inspection console is restricted to reviewing officers.'}
        </p>
        <div className="pt-2">
          <Link
            href="/login"
            className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <User className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
            <span>{bn ? 'অফিসার হিসেবে প্রবেশ করুন' : 'Sign in as Officer'}</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <PageHeader
        title={
          bn
            ? 'ক্রিপ্টোগ্রাফিক চেইন ও অডিট লেজার নিরীক্ষা'
            : 'Cryptographic Audit Ledger & Chain Integrity'
        }
        description={
          bn
            ? 'SHA-256 হ্যাশ চেইনিং ও Ed25519 ডিজিটাল স্বাক্ষরের মাধ্যমে প্রতিটি পরিবর্তন যাচাই করুন।'
            : 'Walks the global audit chain from genesis to head, verifying SHA-256 continuity and Ed25519 digital signatures.'
        }
        action={
          <Button
            variant="primary"
            size="md"
            loading={loading}
            disabled={loading || tampering}
            onClick={runVerification}
            icon={<Search className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />}
          >
            {loading
              ? bn
                ? 'নিরীক্ষা চলছে...'
                : 'Auditing...'
              : t('verify_chain_button')}
          </Button>
        }
      />

      {/* Result Banner */}
      {verification && (
        <div
          role="status"
          className={`p-4 sm:p-5 rounded-lg border text-xs space-y-3 ${
            verification.valid
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                verification.valid
                  ? 'bg-emerald-600 text-white'
                  : 'bg-rose-600 text-white'
              }`}
            >
              {verification.valid ? (
                <Check className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
              ) : (
                <TriangleAlert className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold">
                {verification.valid ? t('chain_valid') : t('chain_invalid')}
              </h2>
              <p className="text-xs mt-0.5 opacity-90">
                {verification.valid
                  ? bn
                    ? `মোট ব্লক: ${formatCount(verification.total_records, language)} • যাচাইকৃত দলিল: ${formatCount(verification.deeds_checked ?? 0, language)} • যাচাইকৃত পার্সেল: ${formatCount(verification.parcels_checked ?? 0, language)} • হেড হ্যাশ: ${verification.latest_hash?.slice(0, 16)}...`
                    : `Total Blocks: ${verification.total_records} • Deeds Checked: ${verification.deeds_checked ?? 0} • Parcels Checked: ${verification.parcels_checked ?? 0} • Head Hash: ${verification.latest_hash?.slice(0, 16)}...`
                  : failureSummary}
              </p>
            </div>
          </div>

          {/* First Failure Breakdown */}
          {!verification.valid && (
            <div className="pt-3 border-t border-rose-200 dark:border-rose-800 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">
                <div className="p-3 rounded-md bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 text-slate-800 dark:text-slate-200">
                  <span className="font-semibold text-slate-500 block mb-1">
                    {bn ? 'প্রত্যাশিত মান (EXPECTED):' : 'EXPECTED VALUE:'}
                  </span>
                  <div className="break-all">{verification.expected_value}</div>
                </div>
                <div className="p-3 rounded-md bg-rose-100/70 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-100">
                  <span className="font-semibold text-rose-700 dark:text-rose-300 block mb-1">
                    {bn ? 'প্রাপ্ত মান (CALCULATED):' : 'CALCULATED VALUE:'}
                  </span>
                  <div className="break-all font-semibold">{verification.calculated_value}</div>
                </div>
              </div>

              {/* Technical Details Accordion */}
              {verification.details && (
                <details className="text-xs group">
                  <summary className="font-semibold text-rose-800 dark:text-rose-300 cursor-pointer hover:underline flex items-center gap-1 select-none">
                    <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" strokeWidth={1.75} aria-hidden="true" />
                    <span>{bn ? 'কারিগরি বিবরণ (Technical details)' : 'Technical details'}</span>
                  </summary>
                  <p className="mt-2 p-2.5 rounded-md bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                    {verification.details}
                  </p>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {/* Audit Checkpoint Section */}
      <Panel
        title={t('checkpoint_section_title')}
        description={t('checkpoint_note')}
        headerAction={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={exportingCheckpoint}
            disabled={exportingCheckpoint || loading || tampering}
            onClick={handleExportCheckpoint}
            icon={<Download className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />}
          >
            {exportingCheckpoint ? t('checkpoint_exporting') : t('checkpoint_export_btn')}
          </Button>
        }
      >
        <div className="space-y-4">
          {exportError && (
            <div
              role="alert"
              className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-center gap-2"
            >
              <TriangleAlert className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" strokeWidth={1.75} aria-hidden="true" />
              <span>{exportError}</span>
            </div>
          )}

          {exportedCheckpoint && (
            <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <span className="text-slate-500 mr-1.5">
                    {bn ? 'হেড সিকোয়েন্স:' : 'Head sequence:'}
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    #{bn ? formatCount(exportedCheckpoint.head_sequence, language) : exportedCheckpoint.head_sequence}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 mr-1.5">
                    {bn ? 'হেড হ্যাশ:' : 'Head hash:'}
                  </span>
                  <span
                    className="font-mono font-semibold text-emerald-700 dark:text-emerald-400"
                    title={exportedCheckpoint.head_hash}
                  >
                    {exportedCheckpoint.head_hash.slice(0, 8)}...{exportedCheckpoint.head_hash.slice(-8)}
                  </span>
                </div>
              </div>
              <span className="font-mono text-[11px] text-slate-500">
                mutationguard-checkpoint-{exportedCheckpoint.head_sequence}.json
              </span>
            </div>
          )}

          {/* Verify against checkpoint */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                {t('checkpoint_verify_title')}
              </h3>
              <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                <span>{bn ? 'JSON ফাইল নির্বাচন করুন' : 'Choose JSON file'}</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleCheckpointFileChange}
                  className="sr-only"
                />
              </label>
            </div>

            <textarea
              value={checkpointInput}
              onChange={(e) => setCheckpointInput(e.target.value)}
              rows={4}
              spellCheck={false}
              aria-label={t('checkpoint_verify_title')}
              placeholder={
                bn
                  ? 'এখানে এক্সপোর্ট করা চেকপয়েন্ট JSON পেস্ট করুন অথবা উপরের বাটন থেকে ফাইল নির্বাচন করুন...'
                  : 'Paste exported checkpoint JSON here or choose a file above...'
              }
              className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            <div className="flex items-center justify-end">
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={verifyingCheckpoint}
                disabled={verifyingCheckpoint || !checkpointInput.trim()}
                onClick={handleVerifyCheckpoint}
                icon={<ShieldCheck className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />}
              >
                {verifyingCheckpoint ? t('checkpoint_verifying') : t('checkpoint_verify_btn')}
              </Button>
            </div>

            {verifyCheckpointError && (
              <div
                role="alert"
                className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-center gap-2"
              >
                <TriangleAlert className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" strokeWidth={1.75} aria-hidden="true" />
                <span>{verifyCheckpointError}</span>
              </div>
            )}

            {checkpointResult && (
              <div
                role="status"
                className={`p-4 rounded-lg border text-xs space-y-3 ${
                  checkpointResult.status === 'MATCH'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      checkpointResult.status === 'MATCH'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    {checkpointResult.status === 'MATCH' ? (
                      <ShieldCheck className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
                    ) : (
                      <ShieldAlert className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-sm">
                      {checkpointResult.status === 'MATCH'
                        ? t('checkpoint_match_title')
                        : t('checkpoint_mismatch_title')}
                    </p>
                    <p className="text-xs opacity-90">
                      {bn
                        ? checkpointResult.status === 'MATCH'
                          ? `লাইভ অডিট চেইনটি চেকপয়েন্টের সাথে মিলেছে (ব্লক #${formatCount(checkpointResult.checkpoint_head_sequence, language)}, লাইভ দৈর্ঘ্য: ${formatCount(checkpointResult.live_chain_length, language)})।`
                          : 'লাইভ অডিট চেইনটি চেকপয়েন্টের সাথে মেলেনি।'
                        : checkpointResult.message}
                    </p>
                  </div>
                </div>

                {/* Per-check results */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
                  {(
                    [
                      ['signature_valid', t('checkpoint_check_signature')],
                      ['chain_valid', t('checkpoint_check_chain')],
                      ['head_matches', t('checkpoint_check_head')],
                      ['chain_not_shorter', t('checkpoint_check_length')],
                    ] as const
                  ).map(([key, label]) => {
                    const ok = checkpointResult.checks[key];
                    return (
                      <div
                        key={key}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-md border ${
                          ok
                            ? 'bg-white/80 dark:bg-slate-900/80 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                            : 'bg-white/80 dark:bg-slate-900/80 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                        }`}
                      >
                        {ok ? (
                          <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} aria-hidden="true" />
                        ) : (
                          <X className="w-3.5 h-3.5 shrink-0 text-rose-600 dark:text-rose-400" strokeWidth={2.5} aria-hidden="true" />
                        )}
                        <span className="font-medium">{label}</span>
                      </div>
                    );
                  })}
                </div>

                {checkpointResult.status === 'MISMATCH' && checkpointResult.expected_hash && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px] pt-2 border-t border-rose-200 dark:border-rose-800">
                    <div className="p-2.5 rounded-md bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 text-slate-800 dark:text-slate-200">
                      <span className="font-semibold text-slate-500 block mb-1">
                        {bn ? 'প্রত্যাশিত হ্যাশ (চেকপয়েন্ট):' : 'EXPECTED HASH (CHECKPOINT):'}
                      </span>
                      <div className="break-all">{checkpointResult.expected_hash}</div>
                    </div>
                    <div className="p-2.5 rounded-md bg-rose-100/70 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-100">
                      <span className="font-semibold text-rose-700 dark:text-rose-300 block mb-1">
                        {bn
                          ? `প্রাপ্ত হ্যাশ (লাইভ ব্লক #${formatCount(checkpointResult.checkpoint_head_sequence, language)}):`
                          : `ACTUAL HASH (LIVE BLOCK #${checkpointResult.checkpoint_head_sequence}):`}
                      </span>
                      <div className="break-all font-semibold">
                        {checkpointResult.actual_hash ??
                          (bn
                            ? `অনুপস্থিত (লাইভ দৈর্ঘ্য: ${formatCount(checkpointResult.live_chain_length, language)})`
                            : `Missing (live chain length: ${checkpointResult.live_chain_length})`)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Panel>

      {/* Demo Tools Panel */}
      <section
        aria-label={bn ? 'ডেমো টুলস' : 'Demo tools'}
        className="rounded-lg border border-amber-300 dark:border-amber-800/80 border-l-[3px] border-l-amber-500 bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-amber-200 dark:border-amber-900/40 pb-2.5">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <h3 className="font-bold text-xs uppercase tracking-wide text-amber-900 dark:text-amber-200">
              {bn ? 'ডেমো টুলস (Demo tools)' : 'Demo tools'}
            </h3>
          </div>
          <span className="text-[11px] text-amber-800 dark:text-amber-300">
            {bn
              ? 'সতর্কতা: এটি আমাদের নিজস্ব ডেমো ডাটাবেসের রেকর্ড পরিবর্তন করে।'
              : 'Warning: This modifies test records in our own demo database.'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {/* Tamper with deed button */}
          <Button
            variant="secondary"
            size="sm"
            loading={tampering}
            disabled={tampering || loading}
            onClick={handleDeedTamper}
            className="border-amber-300 dark:border-amber-700 hover:bg-amber-100/50"
          >
            {bn ? 'দলিলে টেম্পারিং করুন (DEED-2026-001)' : 'Tamper with deed (DEED-2026-001)'}
          </Button>

          {/* Tamper with owner button */}
          <Button
            variant="secondary"
            size="sm"
            loading={tampering}
            disabled={tampering || loading}
            onClick={handleOwnerTamper}
            className="border-amber-300 dark:border-amber-700 hover:bg-amber-100/50"
          >
            {bn ? 'মালিকানায় টেম্পারিং করুন (P-001)' : 'Tamper with owner (P-001)'}
          </Button>

          {/* Block tamper selector and button */}
          {records.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="tamper_seq" className="text-xs text-slate-600 dark:text-slate-400">
                {bn ? 'ব্লক নির্বাচন:' : 'Target Block:'}
              </label>
              <select
                id="tamper_seq"
                value={selectedTamperSeq}
                onChange={(e) => setSelectedTamperSeq(Number(e.target.value))}
                className="min-h-[36px] px-2.5 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono"
              >
                {records.map((b) => (
                  <option key={b.sequence_num} value={b.sequence_num}>
                    #{b.sequence_num} ({b.event_type})
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                loading={tampering}
                disabled={tampering || loading}
                onClick={() => handleSimulateTamper(selectedTamperSeq)}
                className="border-amber-300 dark:border-amber-700 hover:bg-amber-100/50"
              >
                {bn ? 'ব্লক টেম্পারিং টেস্ট' : 'Tamper block test'}
              </Button>
            </div>
          )}
        </div>

        {tamperMessage && (
          <p className="text-xs font-mono text-amber-900 dark:text-amber-200 pt-1">
            {bn ? 'ফলাফল:' : 'Result:'} {tamperMessage}
          </p>
        )}
      </section>

      {/* Global Audit Sequence Explorer */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
          <h2 className="font-bold text-sm text-slate-900 dark:text-white">
            {bn
              ? `সার্বজনীন অডিট সিকোয়েন্স (${formatCount(records.length, language)} টি ব্লক)`
              : `Global Audit Sequence (${records.length} Blocks)`}
          </h2>
          <span className="text-xs text-slate-500 font-mono">
            {bn ? 'পোস্টগ্রেসকিউএল অ্যাডভাইজরি লক দ্বারা সুরক্ষিত' : 'PostgreSQL Advisory Lock'}
          </span>
        </div>

        {records.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
            {bn
              ? 'এখনো কোনো অডিট রেকর্ড তৈরি হয়নি।'
              : 'No audit records created yet.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden text-xs">
            {records.map((block) => (
              <div
                key={block.sequence_num}
                className="p-3.5 space-y-2 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
              >
                {/* Compact Row: sequence, event type, entity, actor, short hash */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      #{block.sequence_num}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
                      {block.event_type}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500 font-mono">
                      {block.entity_id}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">
                      {bn ? 'কর্তৃক:' : 'by'}{' '}
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {localName(block.actor_username, language)}
                      </span>
                    </span>
                    <span
                      className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold"
                      title={block.record_hash}
                    >
                      {block.record_hash?.slice(0, 14)}...
                    </span>
                  </div>
                </div>

                {/* Collapsed Technical Details on Each Row */}
                <details className="text-[11px] text-slate-500 group">
                  <summary className="cursor-pointer hover:underline text-slate-600 dark:text-slate-400 flex items-center gap-1 select-none font-medium">
                    <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" strokeWidth={1.75} aria-hidden="true" />
                    <span>{bn ? 'কারিগরি বিবরণ দেখুন' : 'Show technical details'}</span>
                  </summary>

                  <div className="mt-2 p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 font-mono">
                    <div>
                      <span className="text-slate-400 block mb-0.5">
                        {bn ? 'পূর্ববর্তী হ্যাশ (PREVIOUS HASH):' : 'PREVIOUS HASH:'}
                      </span>
                      <span className="break-all text-slate-700 dark:text-slate-300">
                        {block.previous_hash}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">
                        {bn ? 'সম্পূর্ণ রেকর্ড হ্যাশ (RECORD HASH):' : 'FULL RECORD HASH:'}
                      </span>
                      <span className="break-all text-emerald-700 dark:text-emerald-400 font-semibold">
                        {block.record_hash}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">
                        {bn ? 'ক্যানোনিকাল পেলোড (CANONICAL PAYLOAD):' : 'CANONICAL PAYLOAD:'}
                      </span>
                      <pre className="p-2 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[10px] overflow-x-auto whitespace-pre-wrap border border-slate-200 dark:border-slate-800">
                        {typeof block.payload === 'string'
                          ? block.payload
                          : JSON.stringify(block.payload, null, 2)}
                      </pre>
                    </div>
                  </div>
                </details>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

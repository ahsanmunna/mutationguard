'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import ConflictAlert from '@/components/ConflictAlert';
import { useLanguage } from '@/components/LanguageContext';
import { localName, formatNumber, formatDate, formatCount } from '@/lib/i18n/translations';
import { useCurrentUser } from '@/lib/use-current-user';

export default function TransferDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { language } = useLanguage();

  const [transfer, setTransfer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);


  // Who is logged in comes from the server (signed httpOnly session), not from the browser.
  const { user: sessionUser } = useCurrentUser();
  const currentUsername = sessionUser?.username ?? '';
  const currentUser = sessionUser ?? { username: '', fullName: '', role: 'applicant' as const };
  const isReviewer = currentUser.role === 'reviewer';

  const fetchTransfer = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch(`/api/transfers/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || (language === 'bn' ? 'আবেদনটি লোড করা সম্ভব হয়নি' : 'Failed to load transfer'));
      } else {
        setTransfer(data.transfer);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchTransfer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleTransition = async (targetStatus: string) => {
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const res = await fetch(`/api/transfers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || (language === 'bn' ? 'স্ট্যাটাস হালনাগাদ ব্যর্থ হয়েছে' : 'Failed to update status'));
      } else {
        await fetchTransfer();
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500">
          {language === 'bn' ? `রেকর্ড #${id} লোড হচ্ছে...` : `Loading transfer record #${id}...`}
        </p>
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="p-12 text-center space-y-3">
        <p className="text-rose-600 font-bold">{errorMsg || `Transfer #${id} not found`}</p>
        <Link href="/dashboard" className="text-xs text-emerald-600 font-bold underline inline-flex items-center gap-1">
          <span>←</span>
          <span>{language === 'bn' ? 'ড্যাশবোর্ডে ফিরে যান' : 'Return to Dashboard'}</span>
        </Link>
      </div>
    );
  }

  // Visual Stepper Stages
  const steps = [
    { key: 'submitted', labelBn: 'দাখিলকৃত', labelEn: 'Submitted' },
    { key: 'verified', labelBn: 'যাচাইকৃত', labelEn: 'Verified' },
    { key: 'under_review', labelBn: 'পর্যালোচনাধীন', labelEn: 'Under Review' },
    { key: 'approved', labelBn: 'অনুমোদিত', labelEn: 'Approved' },
    { key: 'finalized', labelBn: 'চূড়ান্ত নিষ্পত্তি', labelEn: 'Finalized' },
  ];

  const getStepStatus = (stepKey: string) => {
    if (transfer.status === 'held' || transfer.status === 'rejected') {
      if (stepKey === 'submitted') return 'completed';
      return 'inactive';
    }
    const order = ['submitted', 'verified', 'under_review', 'approved', 'finalized'];
    const currentIndex = order.indexOf(transfer.status);
    const stepIndex = order.indexOf(stepKey);
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 px-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              {transfer.id}
            </h1>
            <StatusBadge status={transfer.status} size="lg" />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'bn' ? 'আবেদনকারী:' : 'Submitted by'}{' '}
            <span className="font-semibold font-mono text-slate-700 dark:text-slate-300">
              {transfer.applicant_username}
            </span>{' '}
            • {formatDate(transfer.created_at, language)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/verify/${transfer.id}`}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold text-xs hover:bg-emerald-100 transition shadow-xs inline-flex items-center gap-1.5"
          >
            <span>🔍</span>
            <span>{language === 'bn' ? 'পাবলিক কিউআর সনদ' : 'Public QR Certificate'}</span>
          </Link>
          <Link
            href="/dashboard"
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 transition inline-flex items-center gap-1"
          >
            <span>←</span>
            <span>{language === 'bn' ? 'ড্যাশবোর্ড' : 'Back'}</span>
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950 border border-rose-300 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center gap-2">
          <span>❌</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Visual Stepper */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {language === 'bn' ? 'কর্মপ্রবাহের বর্তমান পর্যায়' : 'Workflow Progress Timeline'}
        </h3>
        {transfer.status === 'held' ? (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-semibold flex items-center gap-3">
            <span className="text-2xl">🛑</span>
            <div>
              <p className="font-bold text-sm">
                {language === 'bn' ? 'আবেদনটি স্থগিত অবস্থায় আছে' : 'Transfer Status: Held'}
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                {language === 'bn'
                  ? 'স্বয়ংক্রিয় বিরোধ বা অমিল সনাক্ত হওয়ায় আবেদনটি স্থগিত করা হয়েছে। সহকারী কমিশনার (ভূমি) শুধুমাত্র এটি বাতিল করতে পারেন।'
                  : 'Automated conflict detected upon submission. Reviewer may reject this application.'}
              </p>
            </div>
          </div>
        ) : transfer.status === 'rejected' ? (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs font-semibold flex items-center gap-3">
            <span className="text-2xl">✕</span>
            <div>
              <p className="font-bold text-sm">
                {language === 'bn' ? 'আবেদনটি বাতিল করা হয়েছে' : 'Transfer Status: Rejected'}
              </p>
              <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5">
                {language === 'bn'
                  ? 'এই নামজারি আবেদনটি চূড়ান্তভাবে বাতিল করা হয়েছে।'
                  : 'This transfer has been rejected and closed permanently.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
            {steps.map((st, i) => {
              const stStatus = getStepStatus(st.key);
              return (
                <div
                  key={st.key}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${
                    stStatus === 'completed'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-800 dark:text-emerald-300'
                      : stStatus === 'current'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 font-bold shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'
                  }`}
                >
                  <span className="text-[11px] font-mono">
                    {stStatus === 'completed' ? '✓' : formatCount(i + 1, language)}
                  </span>
                  <span className="font-bold">
                    {language === 'bn' ? st.labelBn : st.labelEn}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reviewer Action Bar (Only for Reviewer role) */}
      {isReviewer && (
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 text-white space-y-4 shadow-md">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚖️</span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {language === 'bn' ? 'সহকারী কমিশনার (ভূমি) অ্যাকশন প্যানেল' : 'Officer Review & Workflow Actions'}
              </span>
            </div>
            <span className="text-xs text-emerald-400 font-mono font-bold">
              {language === 'bn' ? 'বর্তমান ধাপ:' : 'Stage:'} {transfer.status}
            </span>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            {/* verified -> under_review */}
            {transfer.status === 'verified' && (
              <button
                onClick={() => handleTransition('under_review')}
                disabled={actionLoading}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <span>🔍</span>
                <span>{language === 'bn' ? 'পর্যালোচনা শুরু করুন' : 'Pick Up for Review'}</span>
              </button>
            )}

            {/* under_review -> approved or rejected */}
            {transfer.status === 'under_review' && (
              <>
                <button
                  onClick={() => handleTransition('approved')}
                  disabled={actionLoading}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <span>✓</span>
                  <span>{language === 'bn' ? 'অনুমোদন করুন' : 'Approve Transfer'}</span>
                </button>
                <button
                  onClick={() => handleTransition('rejected')}
                  disabled={actionLoading}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <span>✕</span>
                  <span>{language === 'bn' ? 'বাতিল করুন' : 'Reject Transfer'}</span>
                </button>
              </>
            )}

            {/* held -> rejected ONLY */}
            {transfer.status === 'held' && (
              <button
                onClick={() => handleTransition('rejected')}
                disabled={actionLoading}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <span>✕</span>
                <span>{language === 'bn' ? 'স্থগিত আবেদন বাতিল করুন' : 'Reject Conflicting Transfer'}</span>
              </button>
            )}

            {/* approved -> finalized or rejected */}
            {transfer.status === 'approved' && (
              <>
                <button
                  onClick={() => handleTransition('finalized')}
                  disabled={actionLoading}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition disabled:opacity-50 shadow-md inline-flex items-center gap-2"
                >
                  <span>🏛️</span>
                  <span>
                    {language === 'bn'
                      ? 'চূড়ান্ত নিষ্পত্তি ও মালিকানা হালনাগাদ'
                      : 'Execute Atomic Finalization'}
                  </span>
                </button>
                <button
                  onClick={() => handleTransition('rejected')}
                  disabled={actionLoading}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <span>✕</span>
                  <span>{language === 'bn' ? 'বাতিল করুন' : 'Reject'}</span>
                </button>
              </>
            )}

            {transfer.status === 'finalized' && (
              <div className="text-xs text-emerald-400 font-semibold py-1 flex items-center gap-1.5">
                <span>✓</span>
                <span>
                  {language === 'bn'
                    ? 'নামজারি চূড়ান্ত নিষ্পত্তি সম্পন্ন। খতিয়ান ও মালিকানা ইতিহাস অপরিবর্তনীয়ভাবে হালনাগাদ করা হয়েছে।'
                    : 'Transfer finalized. Parcel ownership atomically updated in land registry.'}
                </span>
              </div>
            )}

            {transfer.status === 'rejected' && (
              <div className="text-xs text-rose-400 font-semibold py-1 flex items-center gap-1.5">
                <span>✕</span>
                <span>
                  {language === 'bn' ? 'আবেদনটি বাতিল করা হয়েছে।' : 'Transfer rejected and closed.'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Findings Section */}
      <ConflictAlert findings={transfer.findings || []} />

      {/* Two Column Details: Deed vs Land Registry */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Deed Application Details */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <span>📄</span>
            <span>{language === 'bn' ? 'দাখিলকৃত দলিল ও আবেদনের বিবরণ' : 'Deed & Application Particulars'}</span>
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">{language === 'bn' ? 'দলিল নম্বর:' : 'Deed Number:'}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{transfer.deed_number}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">{language === 'bn' ? 'বিক্রেতা:' : 'Seller:'}</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {localName(transfer.seller_name, language)} ({transfer.seller_nid})
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">{language === 'bn' ? 'ক্রেতা:' : 'Buyer:'}</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {localName(transfer.buyer_name, language)} ({transfer.buyer_nid})
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">{language === 'bn' ? 'মৌজা:' : 'Claimed Mouza:'}</span>
              <span className="font-semibold text-slate-900 dark:text-white">{transfer.application_mouza}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">{language === 'bn' ? 'খতিয়ান / দাগ:' : 'Khatian / Dag:'}</span>
              <span className="font-semibold font-mono text-slate-900 dark:text-white">
                {transfer.application_khatian} / {transfer.application_dag}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">{language === 'bn' ? 'জমির পরিমাণ:' : 'Area (Decimal):'}</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                {formatNumber(transfer.application_area_decimal, language)} {language === 'bn' ? 'শতক' : 'Decimal'}
              </span>
            </div>
            <div className="pt-2">
              <span className="text-slate-500 block mb-1 font-semibold">
                {language === 'bn' ? 'দলিল অ্যাঙ্কর হ্যাশ (SHA-256):' : 'Deed Anchor (SHA-256):'}
              </span>
              <div className="font-mono text-[10px] break-all bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl">
                {transfer.deed_hash}
              </div>
            </div>
          </div>
        </div>

        {/* Official Registry Records */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <span>🏛️</span>
            <span>{language === 'bn' ? 'সরকারি ভূমি রেকর্ড ও রেজিস্ট্রি' : 'Official Land Registry Baseline'}</span>
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">{language === 'bn' ? 'প্লট / পার্সেল আইডি:' : 'Parcel ID:'}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{transfer.parcel_id}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">{language === 'bn' ? 'বর্তমান আইনানুগ মালিক:' : 'Current Legal Owner:'}</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {localName(transfer.registry_owner_name, language)} ({transfer.registry_owner_nid})
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">{language === 'bn' ? 'রেজিস্ট্রি মৌজা:' : 'Registry Mouza:'}</span>
              <span className="font-semibold text-slate-900 dark:text-white">{transfer.registry_mouza}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">{language === 'bn' ? 'রেজিস্ট্রি খতিয়ান / দাগ:' : 'Registry Khatian / Dag:'}</span>
              <span className="font-semibold font-mono text-slate-900 dark:text-white">
                {transfer.registry_khatian} / {transfer.registry_dag}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">{language === 'bn' ? 'মোট নিবন্ধিত পরিমাণ:' : 'Registry Area (Decimal):'}</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                {formatNumber(transfer.registry_area, language)} {language === 'bn' ? 'শতক' : 'Decimal'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

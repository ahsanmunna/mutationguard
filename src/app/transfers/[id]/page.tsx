'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Check,
  ArrowLeft,
  QrCode,
  TriangleAlert,
  CirclePause,
  CircleX,
  Search,
  CheckCircle2,
  XCircle,
  Landmark,
  FileCheck2,
  Clock,
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import ConflictAlert from '@/components/ConflictAlert';
import { Button } from '@/components/ui';
import { useLanguage } from '@/components/LanguageContext';
import { localName, formatNumber, formatDate, formatCount } from '@/lib/i18n/translations';
import { useCurrentUser } from '@/lib/use-current-user';

export default function TransferDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { language } = useLanguage();
  const bn = language === 'bn';

  const [transfer, setTransfer] = useState<any>(null);
  const [ownershipHistory, setOwnershipHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Who is logged in comes from the server (signed httpOnly session)
  const { user: sessionUser } = useCurrentUser();
  const currentUser = sessionUser ?? { username: '', fullName: '', role: 'applicant' as const };
  const isReviewer = currentUser.role === 'reviewer';

  const fetchTransfer = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch(`/api/transfers/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || (bn ? 'আবেদনটি লোড করা সম্ভব হয়নি' : 'Failed to load transfer'));
      } else {
        setTransfer(data.transfer);

        // Fetch ownership history from the public verification endpoint for this record
        try {
          const pubRes = await fetch(`/api/public/verify/${id}`);
          const pubData = await pubRes.json();
          if (pubRes.ok && Array.isArray(pubData.ownership_history)) {
            setOwnershipHistory(pubData.ownership_history);
          }
        } catch {
          // Non-fatal if public verification metadata fails
        }
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
        setErrorMsg(data.error || (bn ? 'স্ট্যাটাস হালনাগাদ ব্যর্থ হয়েছে' : 'Failed to update status'));
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
        <div className="inline-block w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-500">
          {bn ? `রেকর্ড #${id} লোড হচ্ছে...` : `Loading transfer record #${id}...`}
        </p>
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="p-12 text-center space-y-3">
        <p className="text-rose-600 font-semibold">{errorMsg || `Transfer #${id} not found`}</p>
        <Link
          href="/dashboard"
          className="text-xs text-emerald-600 font-semibold underline inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
          <span>{bn ? 'ড্যাশবোর্ডে ফিরে যান' : 'Return to Dashboard'}</span>
        </Link>
      </div>
    );
  }

  // Visual Stepper 5 Stages
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {transfer.id}
            </h1>
            <StatusBadge status={transfer.status} size="md" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {bn ? 'আবেদনকারী:' : 'Applicant:'}{' '}
            <span className="font-medium font-mono text-slate-700 dark:text-slate-300">
              @{transfer.applicant_username}
            </span>{' '}
            • {formatDate(transfer.created_at, language)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/verify/${transfer.id}`}
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <QrCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} aria-hidden="true" />
            <span>{bn ? 'পাবলিক কিউআর সনদ' : 'Public QR Certificate'}</span>
          </Link>
          <Link
            href="/dashboard"
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
            <span>{bn ? 'ড্যাশবোর্ড' : 'Dashboard'}</span>
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center gap-2"
        >
          <TriangleAlert className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Stepper Section */}
      <section className="p-4 sm:p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {bn ? 'কর্মপ্রবাহের বর্তমান পর্যায়' : 'Workflow Progress Timeline'}
        </h3>

        {/* Distinct End State: Held */}
        {transfer.status === 'held' ? (
          <div className="p-4 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3">
            <CirclePause className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-bold text-sm">
                {bn ? 'আবেদনটি স্থগিত অবস্থায় রয়েছে (Held)' : 'Transfer Status: Held'}
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                {bn
                  ? 'স্বয়ংক্রিয় নীতি বিরোধ বা তথ্যের অমিল সনাক্ত হওয়ায় আবেদনটি স্থগিত করা হয়েছে। সহকারী কমিশনার (ভূমি) শুধুমাত্র এটি বাতিল করতে পারেন।'
                  : 'Automated policy conflict detected upon submission. Reviewer may reject this conflicting application.'}
              </p>
            </div>
          </div>
        ) : transfer.status === 'rejected' ? (
          /* Distinct End State: Rejected */
          <div className="p-4 rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-3">
            <CircleX className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-bold text-sm">
                {bn ? 'আবেদনটি বাতিল করা হয়েছে (Rejected)' : 'Transfer Status: Rejected'}
              </p>
              <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
                {bn
                  ? 'এই নামজারি আবেদনটি চূড়ান্তভাবে বাতিল ও বন্ধ করা হয়েছে।'
                  : 'This transfer has been rejected and permanently closed.'}
              </p>
            </div>
          </div>
        ) : (
          /* 5 Stages Joined by a Line */
          <div className="relative">
            {/* Desktop connecting line behind circles */}
            <div className="hidden sm:block absolute top-4 left-6 right-6 h-0.5 bg-slate-200 dark:bg-slate-700 -z-0" />

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-center text-xs relative z-10">
              {steps.map((st, i) => {
                const stStatus = getStepStatus(st.key);
                return (
                  <div
                    key={st.key}
                    className="flex flex-row sm:flex-col items-center sm:justify-center gap-2.5 sm:gap-1.5 p-2 rounded-md sm:p-0 bg-slate-50 sm:bg-transparent dark:bg-slate-800/40 sm:dark:bg-transparent"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-colors shrink-0 ${
                        stStatus === 'completed'
                          ? 'bg-emerald-600 text-white'
                          : stStatus === 'current'
                          ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 dark:ring-emerald-950'
                          : 'bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-slate-400'
                      }`}
                    >
                      {stStatus === 'completed' ? (
                        <Check className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span
                      className={`font-semibold ${
                        stStatus === 'current'
                          ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                          : stStatus === 'completed'
                          ? 'text-slate-900 dark:text-slate-100'
                          : 'text-slate-400'
                      }`}
                    >
                      {bn ? st.labelBn : st.labelEn}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Reviewer Action Panel (Plain bordered panel, NOT dark) */}
      {isReviewer && (
        <section className="p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
              {bn ? 'সহকারী কমিশনার (ভূমি) অ্যাকশন প্যানেল' : 'Officer Review & Workflow Actions'}
            </h3>
            <StatusBadge status={transfer.status} size="sm" />
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            {/* verified -> under_review */}
            {transfer.status === 'verified' && (
              <Button
                variant="primary"
                size="md"
                loading={actionLoading}
                disabled={actionLoading}
                onClick={() => handleTransition('under_review')}
                icon={<Search className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />}
              >
                {bn ? 'পর্যালোচনা শুরু করুন' : 'Pick Up for Review'}
              </Button>
            )}

            {/* under_review -> approved or rejected */}
            {transfer.status === 'under_review' && (
              <>
                <Button
                  variant="primary"
                  size="md"
                  loading={actionLoading}
                  disabled={actionLoading}
                  onClick={() => handleTransition('approved')}
                  icon={<Check className="w-4 h-4" strokeWidth={2} aria-hidden="true" />}
                >
                  {bn ? 'অনুমোদন করুন' : 'Approve Transfer'}
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  loading={actionLoading}
                  disabled={actionLoading}
                  onClick={() => handleTransition('rejected')}
                  icon={<CircleX className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />}
                >
                  {bn ? 'বাতিল করুন' : 'Reject Transfer'}
                </Button>
              </>
            )}

            {/* held -> rejected ONLY */}
            {transfer.status === 'held' && (
              <Button
                variant="danger"
                size="md"
                loading={actionLoading}
                disabled={actionLoading}
                onClick={() => handleTransition('rejected')}
                icon={<CircleX className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />}
              >
                {bn ? 'স্থগিত আবেদন বাতিল করুন' : 'Reject Conflicting Transfer'}
              </Button>
            )}

            {/* approved -> finalized or rejected */}
            {transfer.status === 'approved' && (
              <>
                <Button
                  variant="primary"
                  size="md"
                  loading={actionLoading}
                  disabled={actionLoading}
                  onClick={() => handleTransition('finalized')}
                  icon={<Landmark className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />}
                >
                  {bn ? 'চূড়ান্ত নিষ্পত্তি ও মালিকানা হালনাগাদ' : 'Execute Atomic Finalization'}
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  loading={actionLoading}
                  disabled={actionLoading}
                  onClick={() => handleTransition('rejected')}
                  icon={<CircleX className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />}
                >
                  {bn ? 'বাতিল করুন' : 'Reject'}
                </Button>
              </>
            )}

            {transfer.status === 'finalized' && (
              <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5 py-1">
                <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span>
                  {bn
                    ? 'নামজারি চূড়ান্ত নিষ্পত্তি সম্পন্ন। খতিয়ান ও মালিকানা ইতিহাস অপরিবর্তনীয়ভাবে হালনাগাদ করা হয়েছে।'
                    : 'Transfer finalized. Parcel ownership atomically updated in land registry.'}
                </span>
              </div>
            )}

            {transfer.status === 'rejected' && (
              <div className="text-xs text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1.5 py-1">
                <XCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span>
                  {bn ? 'আবেদনটি বাতিল করা হয়েছে।' : 'Transfer rejected and closed.'}
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Findings Section */}
      <section>
        <ConflictAlert findings={transfer.findings || []} />
      </section>

      {/* Two Column Definition Lists: Deed & Application vs Registry */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Deed and Application Details */}
        <section className="p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
            {bn ? 'দাখিলকৃত দলিল ও আবেদনের বিবরণ' : 'Deed & Application Particulars'}
          </h3>
          <dl className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <div className="py-2 flex justify-between gap-2">
              <dt className="text-slate-500">{bn ? 'দলিল নম্বর:' : 'Deed Number:'}</dt>
              <dd className="font-mono font-semibold text-slate-900 dark:text-white">{transfer.deed_number}</dd>
            </div>
            <div className="py-2 flex justify-between gap-2">
              <dt className="text-slate-500">{bn ? 'দলিলের তারিখ:' : 'Deed Date:'}</dt>
              <dd className="font-mono text-slate-900 dark:text-white">{transfer.deed_date || '—'}</dd>
            </div>
            <div className="py-2 flex justify-between gap-2">
              <dt className="text-slate-500">{bn ? 'বিক্রেতা:' : 'Seller:'}</dt>
              <dd className="font-medium text-slate-900 dark:text-white text-right">
                {localName(transfer.seller_name, language)}{' '}
                <span className="font-mono text-slate-500">({transfer.seller_nid})</span>
              </dd>
            </div>
            <div className="py-2 flex justify-between gap-2">
              <dt className="text-slate-500">{bn ? 'ক্রেতা:' : 'Buyer:'}</dt>
              <dd className="font-medium text-slate-900 dark:text-white text-right">
                {localName(transfer.buyer_name, language)}{' '}
                <span className="font-mono text-slate-500">({transfer.buyer_nid})</span>
              </dd>
            </div>
            <div className="py-2 flex justify-between gap-2">
              <dt className="text-slate-500">{bn ? 'মৌজা:' : 'Claimed Mouza:'}</dt>
              <dd className="font-medium text-slate-900 dark:text-white">{transfer.application_mouza}</dd>
            </div>
            <div className="py-2 flex justify-between gap-2">
              <dt className="text-slate-500">{bn ? 'খতিয়ান / দাগ:' : 'Khatian / Dag:'}</dt>
              <dd className="font-mono font-medium text-slate-900 dark:text-white">
                {transfer.application_khatian} / {transfer.application_dag}
              </dd>
            </div>
            <div className="py-2 flex justify-between gap-2">
              <dt className="text-slate-500">{bn ? 'জমির পরিমাণ:' : 'Claimed Area:'}</dt>
              <dd className="font-bold text-emerald-700 dark:text-emerald-400">
                {formatNumber(transfer.application_area_decimal, language)} {bn ? 'শতক' : 'Decimal'}
              </dd>
            </div>
            {transfer.deed_hash && (
              <div className="py-2 flex flex-col gap-1">
                <dt className="text-slate-500">{bn ? 'দলিল অ্যাঙ্কর হ্যাশ (SHA-256):' : 'Deed Anchor (SHA-256):'}</dt>
                <dd
                  className="font-mono text-[11px] text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800 break-all"
                  title={transfer.deed_hash}
                >
                  {transfer.deed_hash.length > 32
                    ? `${transfer.deed_hash.slice(0, 16)}...${transfer.deed_hash.slice(-16)}`
                    : transfer.deed_hash}
                </dd>
              </div>
            )}
          </dl>
        </section>

        {/* Registry Baseline */}
        <section className="p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
            {bn ? 'সরকারি ভূমি রেকর্ড ও রেজিস্ট্রি' : 'Official Land Registry Baseline'}
          </h3>
          <dl className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <div className="py-2 flex justify-between gap-2">
              <dt className="text-slate-500">{bn ? 'প্লট / পার্সেল আইডি:' : 'Parcel ID:'}</dt>
              <dd className="font-mono font-semibold text-slate-900 dark:text-white">{transfer.parcel_id}</dd>
            </div>
            <div className="py-2 flex justify-between gap-2">
              <dt className="text-slate-500">{bn ? 'বর্তমান আইনানুগ মালিক:' : 'Current Legal Owner:'}</dt>
              <dd className="font-medium text-slate-900 dark:text-white text-right">
                {localName(transfer.registry_owner_name, language)}{' '}
                <span className="font-mono text-slate-500">({transfer.registry_owner_nid})</span>
              </dd>
            </div>
            <div className="py-2 flex justify-between gap-2">
              <dt className="text-slate-500">{bn ? 'রেজিস্ট্রি মৌজা:' : 'Registry Mouza:'}</dt>
              <dd className="font-medium text-slate-900 dark:text-white">{transfer.registry_mouza}</dd>
            </div>
            <div className="py-2 flex justify-between gap-2">
              <dt className="text-slate-500">{bn ? 'রেজিস্ট্রি খতিয়ান / দাগ:' : 'Registry Khatian / Dag:'}</dt>
              <dd className="font-mono font-medium text-slate-900 dark:text-white">
                {transfer.registry_khatian} / {transfer.registry_dag}
              </dd>
            </div>
            <div className="py-2 flex justify-between gap-2">
              <dt className="text-slate-500">{bn ? 'মোট নিবন্ধিত পরিমাণ:' : 'Registry Area:'}</dt>
              <dd className="font-bold text-emerald-700 dark:text-emerald-400">
                {formatNumber(transfer.registry_area, language)} {bn ? 'শতক' : 'Decimal'}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {/* Ownership Timeline */}
      <section className="p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
        <h3 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
          {bn ? 'মালিকানার ইতিহাস ও টাইমলাইন' : 'Ownership History & Timeline'}
        </h3>
        {ownershipHistory && ownershipHistory.length > 0 ? (
          <ol className="space-y-3 border-l-2 border-emerald-500 pl-4 text-xs">
            {ownershipHistory.map((h: any, i: number) => (
              <li key={i} className="relative space-y-1">
                <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-600 ring-4 ring-white dark:ring-slate-900" />
                <div className="font-semibold text-slate-900 dark:text-white">
                  {localName(h.previous_owner_name, language)} → {localName(h.new_owner_name, language)}
                </div>
                <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
                  <span>{h.deed_number}</span>
                  <span>•</span>
                  <span>{formatDate(h.recorded_at, language)}</span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {bn
              ? 'এই পার্সেলের জন্য পূর্বে কোনো মালিকানা পরিবর্তন নথিভুক্ত নেই।'
              : 'No prior ownership changes recorded for this parcel.'}
          </p>
        )}
      </section>
    </div>
  );
}

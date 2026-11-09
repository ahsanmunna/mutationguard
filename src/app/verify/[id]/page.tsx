'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  ShieldAlert,
  Printer,
  ArrowLeft,
  QrCode,
  FileText,
  Clock,
  Landmark,
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui';
import { useLanguage } from '@/components/LanguageContext';
import { localName, formatNumber, formatDate, formatCount } from '@/lib/i18n/translations';

export default function PublicVerifyPage() {
  const params = useParams();
  const id = params?.id as string;
  const { language } = useLanguage();
  const bn = language === 'bn';

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Dedicated public verification endpoint (no authentication required)
        const res = await fetch(`/api/public/verify/${id}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || (bn ? 'রেকর্ডটি যাচাই করা যায়নি' : 'Failed to verify record'));
        }
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    if (id) loadData();
  }, [id, bn]);

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="inline-block w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-500">
          {bn ? `রেকর্ড #${id} যাচাই করা হচ্ছে...` : `Verifying public record #${id}...`}
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4 px-4">
        <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
          <ShieldAlert className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {bn ? 'রেকর্ডটি পাওয়া যায়নি' : 'Record Not Found'}
        </h2>
        <p className="text-xs text-rose-600 dark:text-rose-400 font-mono">
          {error || `ID: ${id}`}
        </p>
        <div className="pt-2">
          <Link
            href="/dashboard"
            className="text-xs text-emerald-600 font-semibold underline inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
            <span>{bn ? 'ড্যাশবোর্ডে ফিরে যান' : 'Return to Dashboard'}</span>
          </Link>
        </div>
      </div>
    );
  }

  const {
    transfer,
    deed,
    parcel,
    ownership_history,
    integrity,
    finalization_audit_record,
    qr_code_data_url,
  } = data;

  const deedHash = deed?.deed_hash || transfer?.deed_hash || '';
  const truncatedHash =
    deedHash.length > 32
      ? `${deedHash.slice(0, 16)}...${deedHash.slice(-16)}`
      : deedHash || 'N/A';

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      {/* Single-Column Record Sheet */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">

        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">
                {bn ? 'ভূমি নামজারি রেকর্ড বিবরণী' : 'Land Mutation Record Sheet'}
              </span>
              <h1 className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                {transfer.id}
              </h1>
            </div>
            <StatusBadge status={transfer.status} size="md" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            {bn ? 'রেকর্ড দাখিলের তারিখ:' : 'Recorded Date:'}{' '}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {formatDate(transfer.created_at, language)}
            </span>
          </p>
        </div>

        {/* 1. Parcel & Current Owner */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {bn ? 'জমির পার্সেল ও বর্তমান মালিক' : 'Parcel & Current Legal Owner'}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
            <div>
              <span className="text-slate-500 block">{bn ? 'পার্সেল আইডি:' : 'Parcel ID:'}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{transfer.parcel_id}</span>
            </div>
            <div>
              <span className="text-slate-500 block">{bn ? 'বর্তমান মালিক:' : 'Current Owner:'}</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {parcel?.current_owner_name ? localName(parcel.current_owner_name, language) : '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">{bn ? 'মৌজা ও দাগ:' : 'Mouza & Dag:'}</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {parcel?.mouza || transfer.application_mouza}, {bn ? 'দাগ' : 'Dag'} {parcel?.dag || transfer.application_dag}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">{bn ? 'জমির পরিমাণ:' : 'Registered Area:'}</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                {formatNumber(parcel?.area_decimal || transfer.application_area_decimal, language)} {bn ? 'শতক' : 'Decimal'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Transfer Parties */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {bn ? 'হস্তান্তরের পক্ষসমূহ ও দলিলের বিবরণ' : 'Transfer Parties & Deed Details'}
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <dt className="text-slate-500 mb-0.5">{bn ? 'বিক্রেতা:' : 'Seller:'}</dt>
              <dd className="font-semibold text-slate-900 dark:text-white">
                {localName(transfer.seller_name, language)}
              </dd>
            </div>
            <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <dt className="text-slate-500 mb-0.5">{bn ? 'ক্রেতা / আবেদনকারী:' : 'Buyer / Transferee:'}</dt>
              <dd className="font-semibold text-slate-900 dark:text-white">
                {localName(transfer.buyer_name, language)}
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap justify-between gap-2 text-xs pt-1">
            <span className="text-slate-500">
              {bn ? 'দলিল নম্বর:' : 'Deed Number:'}{' '}
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{transfer.deed_number}</span>
            </span>
            <span className="text-slate-500">
              {bn ? 'দলিলের তারিখ:' : 'Deed Date:'}{' '}
              <span className="font-mono text-slate-800 dark:text-slate-200">{deed?.deed_date || transfer.deed_date || '—'}</span>
            </span>
          </div>
        </div>

        {/* 3. Ownership History Timeline */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {bn ? 'মালিকানার ইতিহাস ও টাইমলাইন' : 'Ownership History Timeline'}
          </h2>
          {Array.isArray(ownership_history) && ownership_history.length > 0 ? (
            <ol className="space-y-2 border-l-2 border-emerald-500 pl-3.5 text-xs">
              {ownership_history.map((h: any, i: number) => (
                <li key={i} className="relative space-y-0.5">
                  <span className="absolute -left-[19px] top-1.5 w-2 h-2 rounded-full bg-emerald-600" />
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {localName(h.previous_owner_name, language)} → {localName(h.new_owner_name, language)}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {h.deed_number} • {formatDate(h.recorded_at, language)}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-slate-500">
              {bn
                ? 'এখনো কোনো মালিকানা পরিবর্তন নথিভুক্ত হয়নি।'
                : 'No ownership changes recorded yet.'}
            </p>
          )}
        </div>

        {/* 4. Integrity Status (Icon + Text) and Deed Anchor Hash */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {bn ? 'ক্রিপ্টোগ্রাফিক সততা ও দলিল অ্যাঙ্কর' : 'Cryptographic Integrity & Deed Anchor'}
          </h2>

          {/* Integrity status block */}
          {integrity && (
            <div
              className={`p-3.5 rounded-md border text-xs flex items-center gap-2.5 ${
                integrity.status === 'OK'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              }`}
            >
              {integrity.status === 'OK' ? (
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              )}
              <div className="space-y-0.5">
                <p className="font-bold">
                  {integrity.status === 'OK'
                    ? bn
                      ? 'অডিট চেইন ও দলিল যাচাই সফল (OK)'
                      : 'Audit Chain & Deed Verified (OK)'
                    : bn
                    ? 'যাচাই ব্যর্থ (FAIL): পরিবর্তনের চিহ্ন পাওয়া গেছে'
                    : 'Verification FAILED: Alteration Detected'}
                </p>
                <p className="text-[11px] opacity-85">
                  {integrity.status === 'OK'
                    ? bn
                      ? `${formatCount(integrity.total_records ?? 0, language)} টি অডিট ব্লক পুনরায় গণনা করে অপরিবর্তিত পাওয়া গেছে।`
                      : `${integrity.total_records ?? 0} audit blocks recomputed and verified intact.`
                    : bn
                    ? 'লেজার চেইনে বা দলিলের মূল অ্যাঙ্করে অমিল সনাক্ত হয়েছে।'
                    : 'Audit chain hash or deed anchor mismatch detected.'}
                </p>
              </div>
            </div>
          )}

          {/* Deed anchor hash */}
          <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
            <span className="text-slate-500 block">
              {bn ? 'দলিল অ্যাঙ্কর হ্যাশ (SHA-256):' : 'Deed Anchor Hash (SHA-256):'}
            </span>
            <span
              className="font-mono text-slate-800 dark:text-slate-200 block truncate"
              title={deedHash}
            >
              {truncatedHash}
            </span>
          </div>

          {/* Finalization Block (if finalized) */}
          {finalization_audit_record && (
            <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono space-y-1">
              <span className="text-slate-500 block">
                {bn
                  ? `চূড়ান্ত অডিট ব্লক #${formatCount(finalization_audit_record.sequence_num, language)}:`
                  : `Finalization Audit Block #${finalization_audit_record.sequence_num}:`}
              </span>
              <p className="text-slate-800 dark:text-slate-200 truncate" title={finalization_audit_record.record_hash}>
                {finalization_audit_record.record_hash}
              </p>
            </div>
          )}
        </div>

        {/* 5. QR Code */}
        {qr_code_data_url && (
          <div className="border-t border-slate-200 dark:border-slate-800 pt-5 text-center space-y-2">
            <div className="inline-block p-2 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr_code_data_url}
                alt="Verification QR Code"
                className="w-32 h-32 mx-auto"
              />
            </div>
            <p className="text-[11px] text-slate-500 font-mono">
              {bn ? 'পাবলিক সত্যতা যাচাইয়ের জন্য কিউআর স্ক্যান করুন' : 'Scan QR code to verify this record'}
            </p>
          </div>
        )}

        {/* 6. Hackathon Synthetic Data Notice (Never claim official legal verification) */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-5">
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center leading-relaxed">
            {bn
              ? 'বিজ্ঞপ্তি: প্রদর্শিত সকল তথ্য কাল্পনিক এবং ল্যান্ডটেক ইনোভেশন হ্যাকাথন ২০২৬ এর প্রোটোটাইপের অংশ। এটি ক্রিপ্টোগ্রাফিক দলিল অ্যাঙ্কর ও অপরিবর্তনীয় অডিট লগের একটি কারিগরি প্রদর্শনী, কোনো আনুষ্ঠানিক সরকারি বা আইনি সনদ নয়।'
              : 'Notice: All data shown is synthetic and part of an academic prototype for the LandTech Innovation Hackathon 2026. This is a technical demonstration of cryptographic deed anchoring and tamper-evident audit logging, not an official government certificate or legal verification.'}
          </p>
        </div>

        {/* Print Action */}
        <div className="text-center pt-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => window.print()}
            icon={<Printer className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />}
          >
            {bn ? 'রেকর্ড প্রিন্ট করুন' : 'Print Record Sheet'}
          </Button>
        </div>
      </div>
    </div>
  );
}

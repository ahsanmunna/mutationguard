'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import StatusBadge from '@/components/StatusBadge';
import { useLanguage } from '@/components/LanguageContext';
import { localName, formatNumber, formatDate } from '@/lib/i18n/translations';

export default function PublicVerifyPage() {
  const params = useParams();
  const id = params?.id as string;
  const { t, language } = useLanguage();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Uses the dedicated public verification endpoint (no auth required)
        const res = await fetch(`/api/public/verify/${id}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || 'Failed to verify record');
        }
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    if (id) loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500">
          {language === 'bn' ? `রেকর্ড #${id} যাচাই করা হচ্ছে...` : `Verifying public record #${id}...`}
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-4">
        <div className="text-4xl">❌</div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {language === 'bn' ? 'রেকর্ডটি পাওয়া যায়নি' : 'Public Record Not Found'}
        </h2>
        <p className="text-xs text-rose-600 dark:text-rose-400 font-mono">
          {error || `ID: ${id}`}
        </p>
      </div>
    );
  }

  const { transfer, parcel, deed, finalization_audit_record, is_deed_anchored, qr_code_data_url } = data;

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4">
      {/* Official Certificate Card */}
      <div className="p-6 sm:p-10 rounded-3xl bg-white dark:bg-slate-900 border-2 border-emerald-600/40 shadow-xl space-y-6">
        <div className="text-center space-y-2 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-700 text-white flex items-center justify-center font-bold text-2xl shadow-md">
            🏛️
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {language === 'bn' ? 'ডিজিটাল ভূমি নামজারি সত্যতা যাচাইকরণ সনদ' : 'Digital Land Mutation Verification Certificate'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {language === 'bn'
              ? 'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার • মিউটেশনগার্ড ক্রিপ্টোগ্রাফিক লেজার'
              : "Government of the People's Republic of Bangladesh • MutationGuard Immutable Ledger"}
          </p>
        </div>

        {/* QR Code and Primary Status Banner */}
        <div className="flex flex-col sm:flex-row items-center justify-around gap-6 p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          {qr_code_data_url && (
            <div className="text-center space-y-1">
              <img
                src={qr_code_data_url}
                alt="Verification QR Code"
                className="w-36 h-36 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm mx-auto"
              />
              <span className="text-[10px] text-slate-500 font-mono block">
                {language === 'bn' ? 'অফিসিয়াল কিউআর যাচাই' : 'Official QR Anchor'}
              </span>
            </div>
          )}

          <div className="space-y-3 text-center sm:text-left">
            <div>
              <span className="text-xs text-slate-500 block">
                {language === 'bn' ? 'নামজারি ট্র্যাকিং নম্বর:' : 'Record Reference:'}
              </span>
              <span className="font-mono font-black text-xl text-emerald-800 dark:text-emerald-300">
                {transfer.id}
              </span>
            </div>

            <div>
              <span className="text-xs text-slate-500 block mb-1">
                {language === 'bn' ? 'বর্তমান স্ট্যাটাস:' : 'Current Status:'}
              </span>
              <StatusBadge status={transfer.status} size="lg" />
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold">
                {language === 'bn' ? 'আবেদনের তারিখ:' : 'Recorded Date:'}
              </span>{' '}
              {formatDate(transfer.created_at, language)}
            </div>
          </div>
        </div>

        {/* Property Particulars */}
        <div className="space-y-3 text-xs">
          <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] border-b pb-1">
            {language === 'bn' ? 'জমি ও মালিকানা বিবরণী' : 'Property & Parties Summary'}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-slate-500 block">{language === 'bn' ? 'প্লট / পার্সেল আইডি:' : 'Parcel ID:'}</span>
              <span className="font-bold text-slate-900 dark:text-white">{transfer.parcel_id}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-slate-500 block">{language === 'bn' ? 'দলিল নম্বর:' : 'Deed Number:'}</span>
              <span className="font-bold font-mono text-slate-900 dark:text-white">
                {transfer.deed_number}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-slate-500 block">{language === 'bn' ? 'জমির পরিমাণ:' : 'Area (Decimal):'}</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                {formatNumber(transfer.application_area_decimal, language)} {language === 'bn' ? 'শতক' : 'Decimal'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-slate-500 block">{language === 'bn' ? 'বিক্রেতা:' : 'Seller:'}</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {localName(transfer.seller_name, language)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-slate-500 block">{language === 'bn' ? 'ক্রেতা / আবেদনকারী:' : 'Buyer / Applicant:'}</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {localName(transfer.buyer_name, language)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-slate-500 block">{language === 'bn' ? 'মৌজা ও দাগ:' : 'Mouza & Dag:'}</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {transfer.application_mouza}, দাগ {transfer.application_dag}
              </span>
            </div>
          </div>
        </div>

        {/* Cryptographic Deed Anchor Integrity */}
        <div
          className={`p-4 rounded-2xl border text-xs space-y-1.5 ${
            is_deed_anchored
              ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2 font-bold text-sm">
            <span>{is_deed_anchored ? '🛡️' : '⚠️'}</span>
            <span>
              {is_deed_anchored
                ? language === 'bn'
                  ? 'ক্রিপ্টোগ্রাফিক দলিল অ্যাঙ্কর যাচাইকৃত (অপরিবর্তিত)'
                  : 'Cryptographic Deed Anchor Verified (SHA-256 Hash Match)'
                : language === 'bn'
                ? 'সতর্কতা: দলিল অ্যাঙ্কর হ্যাশ অমিল!'
                : 'Warning: Deed Anchor Hash Mismatch!'}
            </span>
          </div>
          <p className="font-mono text-[11px] break-all opacity-80">
            Hash: {deed?.deed_hash || 'N/A'}
          </p>
        </div>

        {/* Finalization Audit Record (if finalized) */}
        {finalization_audit_record && (
          <div className="p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs space-y-1 text-blue-900 dark:text-blue-200 font-mono">
            <div className="flex items-center gap-2 font-bold text-sm">
              <span>🏛️</span>
              <span>
                {language === 'bn'
                  ? `চূড়ান্ত অডিট ব্লক #${finalization_audit_record.sequence_num} নিশ্চিতকৃত`
                  : `Finalization Audit Block #${finalization_audit_record.sequence_num} Confirmed`}
              </span>
            </div>
            <p className="text-[11px] break-all">
              Record Hash: {finalization_audit_record.record_hash}
            </p>
            <p className="text-[11px] text-blue-700 dark:text-blue-300">
              Timestamp: {finalization_audit_record.timestamp}
            </p>
          </div>
        )}

        <div className="text-center pt-2">
          <button
            onClick={() => window.print()}
            className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs shadow-md transition"
          >
            🖨️ {language === 'bn' ? 'সনদ প্রিন্ট করুন' : 'Print Official Certificate'}
          </button>
        </div>
      </div>
    </div>
  );
}

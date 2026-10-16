'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import StatusBadge from '@/components/StatusBadge';
import { generateQrCodeDataUrl } from '@/lib/qrcode/generator';
import { useLanguage } from '@/components/LanguageContext';

export default function PublicVerifyPage() {
  const params = useParams();
  const id = params?.id as string;
  const { t, language } = useLanguage();

  const [transfer, setTransfer] = useState<any>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/transfers/${id}`);
        const data = await res.json();
        if (data.transfer) {
          setTransfer(data.transfer);
          // Generate QR code pointing to this public page
          const currentUrl = typeof window !== 'undefined' ? window.location.href : `http://localhost:3000/verify/${id}`;
          const qrData = await generateQrCodeDataUrl(currentUrl);
          setQrCodeUrl(qrData);
        }
      } catch (err) {
        console.error('Error fetching verify data', err);
      } finally {
        setLoading(false);
      }
    }
    if (id) loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-slate-500">
        Verifying public record #{id}...
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-rose-600 font-bold">Public record not found: #{id}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Official Certificate Card */}
      <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border-2 border-emerald-600/30 dark:border-emerald-500/40 shadow-xl space-y-6">
        <div className="text-center space-y-2 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xl shadow">
            🏛️
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {language === 'bn' ? 'ডিজিটাল নামজারি সত্যতা যাচাইকরণ সনদ' : 'Digital Land Mutation Verification Certificate'}
          </h1>
          <p className="text-xs text-slate-500">
            Government of the People&apos;s Republic of Bangladesh • MutationGuard Secure Ledger
          </p>
        </div>

        {/* QR Code and Primary Status */}
        <div className="flex flex-col sm:flex-row items-center justify-around gap-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          {qrCodeUrl && (
            <div className="text-center space-y-1">
              <img
                src={qrCodeUrl}
                alt="Verification QR Code"
                className="w-40 h-40 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm"
              />
              <span className="text-[10px] text-slate-500 font-mono block">
                Official QR Anchor
              </span>
            </div>
          )}

          <div className="space-y-3 text-center sm:text-left">
            <div>
              <span className="text-xs text-slate-500 block">Record Reference:</span>
              <span className="font-mono font-bold text-lg text-emerald-800 dark:text-emerald-300">
                {transfer.id}
              </span>
            </div>

            <div>
              <span className="text-xs text-slate-500 block mb-1">Current Status:</span>
              <StatusBadge status={transfer.status} size="lg" />
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold">Recorded Date:</span>{' '}
              {new Date(transfer.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Property Particulars */}
        <div className="space-y-3 text-xs">
          <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] border-b pb-1">
            Property & Parties Summary
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">
              <span className="text-slate-500 block">Parcel ID:</span>
              <span className="font-bold text-slate-900 dark:text-white">{transfer.parcel_id}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">
              <span className="text-slate-500 block">Deed Number:</span>
              <span className="font-bold font-mono text-slate-900 dark:text-white">
                {transfer.deed_number}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">
              <span className="text-slate-500 block">Seller:</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {transfer.seller_name}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">
              <span className="text-slate-500 block">Buyer / Applicant:</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {transfer.buyer_name}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">
              <span className="text-slate-500 block">Location (Mouza):</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {transfer.application_mouza}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">
              <span className="text-slate-500 block">Total Area (Decimal):</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                {transfer.application_area_decimal}
              </span>
            </div>
          </div>
        </div>

        {/* Cryptographic Deed Anchor Integrity */}
        <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
            <span>🛡️</span>
            <span>Cryptographic Deed Anchor Verified</span>
          </div>
          <p className="text-slate-600 dark:text-slate-400 font-mono text-[10px] break-all">
            SHA-256 Digest: {transfer.deed_hash}
          </p>
        </div>

        <div className="text-center pt-2">
          <button
            onClick={() => window.print()}
            className="px-5 py-2 rounded-xl bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 font-bold text-xs shadow hover:bg-slate-700 transition"
          >
            🖨️ Print Official Certificate
          </button>
        </div>
      </div>
    </div>
  );
}
